/**
 * Turning a spoken answer into text.
 *
 * Children aged 4-7 cannot type, so for that age band the open-ended answers
 * arrive as audio. This transcribes them, and the transcript then goes through
 * exactly the same rubric grading as a typed answer — the grader never knows
 * or cares which it was.
 *
 * Two things worth knowing about transcribing small children:
 *
 * 1. Accuracy is worse than for adults. Young voices, partial words and
 *    background noise all hurt. A transcript is a best effort, not a record,
 *    which is why the raw transcript is returned to the app and shown to the
 *    parent — so a wrong transcription is visible rather than silently graded.
 *
 * 2. The grading prompt already forbids penalising phrasing, which matters more
 *    here: a transcript of a five-year-old is not tidy prose and must not be
 *    marked down for that.
 */

import OpenAI from 'openai';
import { apiKeyProblem } from './grader.js';

/** Generous for a child's answer, small enough to bound abuse. */
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const problem = apiKeyProblem();
    if (problem) {
      throw new Error(`${problem} Put a real key in server/.env, or set USE_MOCK_GRADER=1.`);
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/**
 * @param audio  the recording, already decoded from base64
 * @param filename  extension should match the audio's real format
 * @param declaredMimeType  what the recorder reported; preferred over the
 *   filename, since on web the recording URL carries no extension at all
 */
export async function transcribeAnswer(
  audio: Buffer,
  filename: string,
  declaredMimeType?: string
): Promise<string> {
  if (audio.byteLength === 0) {
    throw new Error('The recording was empty.');
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    throw new Error(`The recording is too large (${Math.round(audio.byteLength / 1024)}KB).`);
  }

  if (process.env.USE_MOCK_GRADER === '1') {
    return '[mock transcript] Set USE_MOCK_GRADER=0 for real speech-to-text.';
  }

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';

  // Prefer what the recorder declared; fall back to the extension. The client
  // reads the type off the blob, which is the only reliable source on web.
  const type = declaredMimeType?.trim() || guessMimeType(filename);

  const file = new File([new Uint8Array(audio)], filename, { type });

  let result;
  try {
    result = await getClient().audio.transcriptions.create({
      file,
      model,
      // Steering the model toward the domain improves recognition of a child
      // answering a reasoning question rather than dictating prose.
      prompt: 'A young child aged four to seven answering a simple reasoning question out loud.',
      language: 'en',
    });
  } catch (err) {
    // Say what we actually sent. "Invalid file format" is meaningless without
    // knowing which format went out, and that is the usual cause here.
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `${reason} (sent ${filename}, type ${type}, ${Math.round(audio.byteLength / 1024)}KB, model ${model})`
    );
  }

  return (result.text ?? '').trim();
}

function guessMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'm4a':
      return 'audio/mp4';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'webm':
      return 'audio/webm';
    case 'ogg':
      return 'audio/ogg';
    default:
      return 'application/octet-stream';
  }
}
