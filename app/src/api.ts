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
      if (err.message === 'Network request failed') {
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

export function fetchTest(age?: number): Promise<TestPayload> {
  const qs = age ? `?age=${encodeURIComponent(age)}` : '';
  return request<TestPayload>(`/api/test${qs}`);
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
