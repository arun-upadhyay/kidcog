import type { TraitKey, TraitMetaPublic } from './types';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { ChildProfile, Report, ResponseInput, TestPayload } from './types';
import type { AssessmentSessionSummary, HistoricalAssessment, SavedChildProfile } from './types';
import { supabase } from './auth/supabase';

/**
 * Where the app finds your server: EXPO_PUBLIC_API_URL, else app.json's
 * extra.apiBaseUrl. A localhost address is rewritten for phones below.
 */
function configuredBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const fromConfig = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  return (fromConfig ?? 'http://localhost:4000').replace(/\/$/, '');
}

/**
 * On a phone, "localhost" is the phone itself, so a localhost address can
 * never reach the server on your computer. During development Expo already
 * knows your computer's network address (it is how the phone loaded the app
 * in the first place: hostUri, e.g. "192.168.1.24:8081"), so swap it in.
 * This works for Expo Go on a real phone, the iOS simulator and the Android
 * emulator alike. Web and production builds (a real https URL) are untouched.
 */
function resolveBaseUrl(): string {
  const url = configuredBaseUrl();
  if (Platform.OS === 'web') return url;

  const pointsAtLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);
  if (!pointsAtLocalhost) return url;

  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  // Only a LAN address. In `expo start --tunnel` mode hostUri is a public
  // tunnel name that forwards Metro only, not port 4000.
  const isLanHost = !!devHost && (/^\d{1,3}(\.\d{1,3}){3}$/.test(devHost) || devHost.endsWith('.local'));
  if (isLanHost && devHost !== '127.0.0.1') {
    return url.replace(/(localhost|127\.0\.0\.1)/i, devHost!);
  }
  // No dev host known: fall back to the old emulator rule.
  return Platform.OS === 'android' ? url.replace(/(localhost|127\.0\.0\.1)/i, '10.0.2.2') : url;
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
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error('Please sign in again.');
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}`, ...headers },
    });

    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Server returned something that isn't JSON (${res.status}).`);
    }

    if (!res.ok) {
      // The account was deleted (on this or another device): drop the local
      // session so the app returns to the sign-in screen instead of failing
      // on every request.
      if (res.status === 403 && typeof body === 'object' && body !== null && (body as { code?: unknown }).code === 'account_deleted') {
        void supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      }
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
        // Expo's native fetch on iOS says "UnexpectedException: Could not
        // connect to the server." and times out as "The request timed out."
        /Network request failed|Failed to fetch|Load failed|NetworkError|Could not connect|UnexpectedException|timed out|offline/i.test(
          err.message
        ) ||
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

export function listChildren(): Promise<SavedChildProfile[]> {
  return request<SavedChildProfile[]>('/api/children');
}

export function saveChild(nickname: string, age: number): Promise<SavedChildProfile> {
  return request<SavedChildProfile>('/api/children', { method: 'POST', body: JSON.stringify({ nickname, age }) });
}

export function deleteChildProfile(childId: string): Promise<void> {
  return request(`/api/children/${encodeURIComponent(childId)}`, { method: 'DELETE' });
}

export function listAssessmentSessions(childId: string, offset = 0): Promise<{ sessions: AssessmentSessionSummary[]; hasMore: boolean }> {
  return request(`/api/children/${encodeURIComponent(childId)}/sessions?limit=20&offset=${offset}`);
}

export function fetchHistoricalAssessment(sessionId: string): Promise<HistoricalAssessment> {
  return request(`/api/sessions/${encodeURIComponent(sessionId)}/report`);
}

export function deleteAssessmentSession(sessionId: string): Promise<void> {
  return request(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

export async function fetchTest(childProfileId: string, sessionId: string | null, age?: number, trait?: TraitKey, limit = 5): Promise<TestPayload> {
  const requestId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
  const test = await request<TestPayload>('/api/test', {
    // Writing, reviewing and (if needed) repairing a round are sequential model
    // calls. The server bounds itself to fit inside this.
    method: 'POST', timeoutMs: 240000,
    body: JSON.stringify({ childProfileId, sessionId, age: age ?? 5, trait, count: limit, requestId }),
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
  sessionId: string;
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

/**
 * Delete the parent's account. Sign-in is blocked straight away and everything
 * is permanently erased after the grace period the server returns.
 */
export function deleteAccount(): Promise<{ deleted: boolean; purgeAfter: string; graceDays: number }> {
  return request('/api/account', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) });
}
