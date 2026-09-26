/**
 * Sign in with Apple, server side: keep Apple's refresh token so it can be
 * revoked when a parent deletes their account.
 *
 * Signing in itself happens in the app (native Apple sheet on iPhone) and in
 * Supabase Auth. The app then sends the one-time authorization code here; we
 * swap it with Apple for a refresh token and store it. On account deletion,
 * revokeAppleTokens() tells Apple to end the app's link to that Apple ID.
 *
 * Needs, in server/.env (from developer.apple.com → Certificates, IDs & Profiles → Keys):
 *   APPLE_TEAM_ID      your 10-character Team ID
 *   APPLE_KEY_ID       the Key ID of a key with "Sign in with Apple" enabled
 *   APPLE_PRIVATE_KEY  the contents of that key's .p8 file (newlines as \n)
 *   APPLE_CLIENT_ID    the iOS bundle identifier: com.ritvikglobal.kidcog
 * Without them, Apple sign-in still works; tokens just are not stored/revoked,
 * and the server prints a warning.
 */
import { createPrivateKey, sign } from 'crypto';
import { supabaseAdmin } from './supabase.js';

const TOKEN_URL = 'https://appleid.apple.com/auth/token';
const REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

function config() {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const keyId = process.env.APPLE_KEY_ID?.trim();
  const clientId = process.env.APPLE_CLIENT_ID?.trim();
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!teamId || !keyId || !clientId || !privateKey) return null;
  return { teamId, keyId, clientId, privateKey };
}

export function appleConfigured(): boolean { return config() !== null; }

let warned = false;
function warnNotConfigured() {
  if (warned) return;
  warned = true;
  console.warn('\n  ⚠  Sign in with Apple tokens are not being stored: set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY and APPLE_CLIENT_ID in server/.env.\n');
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

/** Apple's "client secret": a short-lived ES256 JWT signed with the .p8 key. */
function clientSecret(c: NonNullable<ReturnType<typeof config>>): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: c.keyId }));
  const payload = b64url(JSON.stringify({ iss: c.teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: c.clientId }));
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), {
    key: createPrivateKey(c.privateKey),
    dsaEncoding: 'ieee-p1363', // JWT wants raw r||s, not DER
  });
  return `${header}.${payload}.${b64url(signature)}`;
}

async function postForm(url: string, fields: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { /* revoke returns an empty body */ }
  return { ok: res.ok, status: res.status, body };
}

/**
 * Swap the one-time authorization code (valid ~5 minutes) for a refresh token
 * and remember it for this parent. Returns false when Apple is not configured.
 */
export async function storeAppleAuthorizationCode(parentId: string, code: string): Promise<boolean> {
  const c = config();
  if (!c) { warnNotConfigured(); return false; }
  const result = await postForm(TOKEN_URL, {
    client_id: c.clientId,
    client_secret: clientSecret(c),
    code,
    grant_type: 'authorization_code',
  });
  const refreshToken = typeof result.body.refresh_token === 'string' ? result.body.refresh_token : null;
  if (!result.ok || !refreshToken) {
    throw new Error(`Apple did not accept the authorization code (${result.status} ${String(result.body.error ?? '')}).`);
  }
  const { error } = await supabaseAdmin.from('apple_tokens').upsert(
    { parent_id: parentId, refresh_token: refreshToken, client_id: c.clientId, updated_at: new Date().toISOString() },
    { onConflict: 'parent_id' }
  );
  if (error) throw new Error(`Could not store the Apple token: ${error.message}. Has supabase/migrations/202609260001_apple_sign_in_tokens.sql been run?`);
  return true;
}

/** Tell Apple to end this app's link to the parent's Apple ID. Best effort. */
export async function revokeAppleTokens(parentId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('apple_tokens').select('refresh_token,client_id').eq('parent_id', parentId).maybeSingle();
  if (error || !data) return; // not an Apple user, or the table is not set up
  const c = config();
  if (!c) { warnNotConfigured(); return; }
  const result = await postForm(REVOKE_URL, {
    client_id: data.client_id,
    client_secret: clientSecret({ ...c, clientId: data.client_id }),
    token: data.refresh_token,
    token_type_hint: 'refresh_token',
  });
  if (!result.ok) {
    console.error(`  ✗ Apple token revocation failed for ${parentId}: ${result.status} ${String(result.body.error ?? '')}`);
    return;
  }
  await supabaseAdmin.from('apple_tokens').delete().eq('parent_id', parentId);
  console.log(`  • Revoked Sign in with Apple for ${parentId}.`);
}
