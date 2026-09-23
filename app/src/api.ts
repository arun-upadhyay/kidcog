import type { TraitKey, TraitMetaPublic } from './types';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { ChildProfile, Report, ResponseInput, TestPayload } from './types';

/**
 * Where the app finds your server.
 *
 * `localhost` means "this device". On an iOS simulator that is your Mac, so it
 * works. On an Android emulator localhost is the emulator itself, so Android
 * needs 10.0.2.2 instead. On a PHYSICAL phone neither works — set
 * EXPO_PUBLIC_API_URL to your computer's LAN address, e.g.
 *
 *   EXPO_PUBLIC_API_URL=http://192.168.1.24:4000 npx expo start
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const fromConfig = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  if (fromConfig && Platform.OS === 'android') {
    return fromConfig.replace('localhost', '10.0.2.2').replace(/\/$/, '');
  }
  return (fromConfig ?? 'http://localhost:4000').replace(/\/$/, '');
}

export const API_BASE_URL = resolveBaseUrl();

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 60_000, headers, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...headers },
    });

    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Server returned something that isn't JSON (${res.status}).`);
    }

    if (!res.ok) {
      // Include `detail` when the server sent one. Without it every failure
      // reads as the same unhelpful sentence, which is how a wrong model name
      // and a missing microphone end up looking identical.
      const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
      const headline = 'error' in record ? String(record.error) : `Request failed (${res.status}).`;
      const detail = 'detail' in record ? String(record.detail) : '';
      throw new Error(detail ? `${headline} — ${detail}` : headline);
    }

    return body as T;
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error('The server took too long to respond.');
      }
      // Each platform words "I could not open a connection" differently:
      // React Native says "Network request failed", browsers say "Failed to
      // fetch" or "Load failed". Matching only one of them meant the web build
      // showed the raw browser string, which tells a parent nothing about what
      // to do. Match the platform wordings, and fall back to the TypeError
      // that fetch throws when the request never left the device.
      const unreachable =
        /Network request failed|Failed to fetch|Load failed|NetworkError/i.test(err.message) ||
        err.name === 'TypeError';
      if (unreachable) {
        throw new Error(
          `Could not reach the server at ${API_BASE_URL}. Is it running, and is the address right for this device?`
        );
      }
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function fetchCategories(): Promise<TraitMetaPublic[]> {
  return request<TraitMetaPublic[]>('/api/categories');
}

export async function fetchTest(age?: number, exclude: string[] = [], trait?: TraitKey, limit = 5): Promise<TestPayload> {
  const requestId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
  const test = await request<TestPayload>('/api/test', {
    method: 'POST', timeoutMs: 90000,
    body: JSON.stringify({ age: age ?? 5, trait, count: limit, exclude, requestId }),
  });
  if (!test.profile || typeof test.profile.uiScale !== 'number' || !Array.isArray(test.questions)) {
    throw new Error('This server is incompatible. Start the backend from Documents/kidcog/server and try again.');
  }
  return test;
}

/**
 * Send a recording for transcription.
 *
 * The audio goes as base64 inside JSON rather than multipart. Multipart uploads
 * from React Native are a well-known source of platform-specific breakage, and
 * a few seconds of a child's speech is small enough that the ~33% base64
 * overhead costs less than the debugging would.
 */
export function transcribeAudio(
  audioBase64: string,
  filename: string,
  mimeType?: string
): Promise<{ text: string }> {
  return request<{ text: string }>('/api/transcribe', {
    method: 'POST',
    body: JSON.stringify({ audioBase64, filename, mimeType }),
    timeoutMs: 60_000,
  });
}

export function submitAnswers(payload: {
  child: ChildProfile | null;
  responses: ResponseInput[];
}): Promise<Report> {
  return request<Report>('/api/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
    // Grading is a model call, so allow generous time.
    timeoutMs: 90_000,
  });
}
