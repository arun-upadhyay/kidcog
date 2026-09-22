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
      const message =
        typeof body === 'object' && body !== null && 'error' in body
          ? String((body as { error: unknown }).error)
          : `Request failed (${res.status}).`;
      throw new Error(message);
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
