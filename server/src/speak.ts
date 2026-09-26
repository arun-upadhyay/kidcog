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
import { supabaseAdmin, supabaseReady } from './supabase.js';
import { apiKeyProblem } from './grader.js';

export const SPEECH_MIME = 'audio/mpeg';

const DEFAULT_INSTRUCTIONS =
  'You are reading a puzzle question aloud to a child aged four to seven. ' +
  'Speak warmly and unhurriedly, the way a kind teacher reads to a small child. ' +
  'Leave a small pause after each idea so the child has time to take it in. ' +
  'Sound interested and encouraging, never stern, and never rushed.';

/**
 * Longest text we will synthesise. Questions are short, but the parent report
 * read aloud is several paragraphs, so this has to accommodate both. Still
 * bounded, because every character is billed and waited on.
 */
const MAX_TEXT = 2500;

/**
 * Generated audio, kept in memory.
 *
 * A Map preserves insertion order, so evicting the oldest entry is just taking
 * the first key. Bounded so a long-running server cannot grow without limit.
 */
const cache = new Map<string, Buffer>();
const MAX_CACHED = 200;
const inFlight = new Map<string, Promise<SpeechResult>>();

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const problem = apiKeyProblem();
    if (problem) throw new Error(problem);
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 1 });
  }
  return client;
}

export interface SpeechResult {
  audio: Buffer;
  cached: boolean;
}

function speechSettings() {
  return {
    model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    voice: process.env.OPENAI_TTS_VOICE || 'coral',
    instructions: process.env.OPENAI_TTS_INSTRUCTIONS || DEFAULT_INSTRUCTIONS,
  };
}

function checkedText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Nothing to say.');
  if (trimmed.length > MAX_TEXT) {
    throw new Error(`Text is too long to speak (${trimmed.length} characters, limit ${MAX_TEXT}).`);
  }
  return trimmed;
}

/**
 * The code for a text's audio. Keyed on everything that changes the output,
 * so switching voice in .env does not serve the old one back from cache. The
 * same code names the stored audio file, and it is what goes in the audio
 * address, so the text (which can include a child's name) never does.
 */
export function speechKeyFor(text: string): string {
  const { model, voice, instructions } = speechSettings();
  return createHash('sha256').update([model, voice, instructions, checkedText(text)].join('\u0000')).digest('hex');
}

/**
 * Texts a signed-in parent (or the server itself) has asked to have read out,
 * by code. Only these can be turned into new audio, so the public audio
 * address cannot be used to spend OpenAI credit on arbitrary text. Kept a day;
 * after a restart the app simply registers the text again.
 */
const registered = new Map<string, { text: string; expires: number }>();
const REGISTRY_LIMIT = 5000;
const REGISTRY_TTL = 24 * 60 * 60 * 1000;
export function registerSpeech(text: string): string {
  const trimmed = checkedText(text);
  const key = speechKeyFor(trimmed);
  registered.delete(key);
  registered.set(key, { text: trimmed, expires: Date.now() + REGISTRY_TTL });
  while (registered.size > REGISTRY_LIMIT) {
    const oldest = registered.keys().next().value;
    if (oldest === undefined) break;
    registered.delete(oldest);
  }
  return key;
}

/**
 * Audio for a code: from memory or storage if it was ever made, otherwise
 * made now, but only for a registered text. Null means "register it first".
 */
export async function speechForKey(key: string): Promise<SpeechResult | null> {
  const hit = cache.get(key);
  if (hit) return { audio: hit, cached: true };
  const pending = inFlight.get(key);
  if (pending) return pending;
  const entry = registered.get(key);
  if (entry && entry.expires > Date.now()) return synthesizeSpeech(entry.text);
  const stored = await fromStorage(key);
  if (stored) { remember(key, stored); return { audio: stored, cached: true }; }
  return null;
}

export async function synthesizeSpeech(text: string): Promise<SpeechResult> {
  const trimmed = checkedText(text);
  const { model, voice, instructions } = speechSettings();
  // Registered too, so audio the server makes ahead of time can be fetched by code.
  const key = registerSpeech(trimmed);

  const hit = cache.get(key);
  if (hit) return { audio: hit, cached: true };

  const pending = inFlight.get(key);
  if (pending) return pending;
  const work = (async () => {
    const stored = await fromStorage(key);
    if (stored) { remember(key, stored); return { audio: stored, cached: true }; }
    const made = await generateSpeech();
    void toStorage(key, made.audio);
    return made;
  })();
  inFlight.set(key, work);
  try { return await work; }
  finally { inFlight.delete(key); }

  async function generateSpeech(): Promise<SpeechResult> {
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
  remember(key, audio);
  return { audio, cached: false };
  }
}

function remember(key: string, audio: Buffer) {
  if (cache.size >= MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, audio);
}

/*
 * Permanent copy in Supabase Storage (bucket "tts-cache", created by migration
 * 202609280001_question_bank.sql). The memory cache above is lost on every
 * restart or deploy; this one is not, so each question's audio is paid for
 * once ever, however many children hear it. Any storage problem just means
 * making the audio again, never a failed request.
 */
const BUCKET = 'tts-cache';
let storageOff = false;
function storageUsable() {
  return !storageOff && supabaseReady() && typeof (supabaseAdmin as { storage?: unknown })?.storage === 'object';
}
function storageProblem(message: string) {
  if (/bucket/i.test(message) && /not.?found|does not exist/i.test(message)) {
    storageOff = true;
    console.warn('  ⚠ Supabase Storage bucket "tts-cache" is missing, so read-aloud audio is only cached until restart. Run supabase/migrations/202609280001_question_bank.sql.');
  }
}
async function fromStorage(key: string): Promise<Buffer | null> {
  if (!storageUsable()) return null;
  try {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(`${key}.mp3`);
    if (error || !data) { if (error) storageProblem(error.message); return null; }
    return Buffer.from(await data.arrayBuffer());
  } catch { return null; }
}
async function toStorage(key: string, audio: Buffer) {
  if (!storageUsable()) return;
  try {
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(`${key}.mp3`, audio, { contentType: 'audio/mpeg', upsert: true });
    if (error) storageProblem(error.message);
  } catch { /* the audio still plays; it just isn't kept */ }
}

export function speechCacheSize(): number {
  return cache.size;
}
