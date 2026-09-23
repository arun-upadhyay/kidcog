/**
 * Reading questions aloud, with OpenAI rather than the device's built-in voice.
 *
 * The platform speech synthesiser is robotic in a way that matters here: the
 * audience is four years old, this is the only way they receive the question,
 * and a flat mechanical delivery is both harder to follow and less inviting.
 *
 * The newer TTS model takes an `instructions` parameter, so we can ask for the
 * delivery rather than only the words — warm, unhurried, the way an adult
 * naturally reads to a small child.
 *
 * Caching matters more than it might look. The same eight questions are read at
 * the start of every session, so without a cache you would pay for and wait on
 * identical audio every single time. With one, each question is generated once
 * and replays instantly.
 */

import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { apiKeyProblem } from './grader.js';

export const SPEECH_MIME = 'audio/mpeg';

const DEFAULT_INSTRUCTIONS =
  'You are reading a puzzle question aloud to a child aged four to seven. ' +
  'Speak warmly and unhurriedly, the way a kind teacher reads to a small child. ' +
  'Leave a small pause after each idea so the child has time to take it in. ' +
  'Sound interested and encouraging, never stern, and never rushed.';

/** Longest text we will synthesise. Questions are short; this bounds abuse. */
const MAX_TEXT = 600;

/**
 * Generated audio, kept in memory.
 *
 * A Map preserves insertion order, so evicting the oldest entry is just taking
 * the first key. Bounded so a long-running server cannot grow without limit.
 */
const cache = new Map<string, Buffer>();
const MAX_CACHED = 200;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const problem = apiKeyProblem();
    if (problem) throw new Error(problem);
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export interface SpeechResult {
  audio: Buffer;
  cached: boolean;
}

export async function synthesizeSpeech(text: string): Promise<SpeechResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Nothing to say.');
  if (trimmed.length > MAX_TEXT) {
    throw new Error(`Text is too long to speak (${trimmed.length} characters, limit ${MAX_TEXT}).`);
  }

  const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
  const voice = process.env.OPENAI_TTS_VOICE || 'coral';
  const instructions = process.env.OPENAI_TTS_INSTRUCTIONS || DEFAULT_INSTRUCTIONS;

  // Key on everything that changes the output, so switching voice in .env does
  // not serve the old one back from cache.
  const key = createHash('sha256')
    .update([model, voice, instructions, trimmed].join('\u0000'))
    .digest('hex');

  const hit = cache.get(key);
  if (hit) return { audio: hit, cached: true };

  let response;
  try {
    response = await getClient().audio.speech.create({
      model,
      voice,
      input: trimmed,
      instructions,
      response_format: 'mp3',
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`${reason} (model ${model}, voice ${voice})`);
  }

  const audio = Buffer.from(await response.arrayBuffer());

  if (cache.size >= MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, audio);

  return { audio, cached: false };
}

export function speechCacheSize(): number {
  return cache.size;
}
