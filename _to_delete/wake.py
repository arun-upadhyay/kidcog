import sys,os
root=sys.argv[1]  # repo root (kidcog)
def r(p,a,b,c=1):
    p=os.path.join(root,p); s=open(p).read(); assert s.count(a)==c,(p,a,s.count(a)); open(p,'w').write(s.replace(a,b))

# 1. App: wake the server as soon as the app opens (and when the sign-in screen shows).
r('app/src/api.ts',"""interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}
""","""interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Wakes the server without waiting for it. On Render's free plan the server
 * goes to sleep after about 15 minutes with no visitors and takes up to a
 * minute to start again. Calling this when the app opens (and again on the
 * sign-in screen) starts that while the parent is still reading or typing, so
 * "Loading your saved players…" does not have to wait for it afterwards.
 * Sends nothing about the user; at most one call every five minutes.
 */
let lastWake = 0;
export function wakeServer(): void {
  if (API_CONFIG_PROBLEM || Date.now() - lastWake < 5 * 60_000) return;
  lastWake = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  void fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
    .catch(() => { lastWake = 0; })
    .finally(() => clearTimeout(timer));
}
""")
r('app/App.tsx',"import { deleteAccount, deleteChildProfile, fetchTest, getParentReport, listChildren, prefetchRound, saveChild, submitAnswers, updateChildAvatar } from './src/api';",
  "import { deleteAccount, deleteChildProfile, fetchTest, getParentReport, listChildren, prefetchRound, saveChild, submitAnswers, updateChildAvatar, wakeServer } from './src/api';")
r('app/App.tsx',"""  const parentId = session?.user.id;
""","""  const parentId = session?.user.id;
  // Start the server waking up while the welcome or sign-in page is showing.
  useEffect(() => { wakeServer(); }, []);
  // After a few seconds of loading, say why (a sleeping server), not just spin.
  const [slowProfiles, setSlowProfiles] = useState(false);
  useEffect(() => {
    setSlowProfiles(false);
    if (!parentId || profilesOwner === parentId || profilesError) return;
    const timer = setTimeout(() => setSlowProfiles(true), 4000);
    return () => clearTimeout(timer);
  }, [parentId, profilesOwner, profilesError, profilesAttempt]);
""")
r('app/App.tsx',"""            </> : <><ActivityIndicator color="#7650C7" /><Text>Loading your saved players…</Text></>}""",
"""            </> : <><ActivityIndicator color="#7650C7" /><Text>Loading your saved players…</Text>
              {slowProfiles ? <Text style={{ textAlign: 'center', color: '#6D5A49', maxWidth: 360 }}>KidCog is waking up after a quiet spell. The first visit can take up to a minute; after that it's quick.</Text> : null}</>}""")
r('app/src/screens/LoginScreen.tsx',"import React, { useEffect, useState } from 'react';\n","import React, { useEffect, useState } from 'react';\nimport { wakeServer } from '../api';\n")
r('app/src/screens/LoginScreen.tsx',"export default function LoginScreen() {\n","export default function LoginScreen() {\n  // A parent is about to sign in or sign up: make sure the server is awake for them.\n  useEffect(() => { wakeServer(); }, []);\n")

# 2. Server: don't re-check every request's token with Supabase Auth.
r('server/src/supabase.ts',"""import { createClient } from '@supabase/supabase-js';
""","""import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
""")
r('server/src/supabase.ts',"""export async function userIdFromBearer(header?: string): Promise<string | null> {
  const token = header?.match(/^Bearer\\s+(.+)$/i)?.[1];
  if (!token || !supabaseReady()) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}""","""/**
 * Tokens Supabase has already confirmed, for a minute. Opening the app makes
 * several requests at once (players, activities, prefetch), and each one used
 * to wait on its own round trip to Supabase Auth. Keyed by a hash so no token
 * is kept in memory; account deletion is still checked on every request.
 */
const VERIFIED_MS = 60_000;
const verified = new Map<string, { userId: string; until: number }>();
const pending = new Map<string, Promise<string | null>>();

export async function userIdFromBearer(header?: string): Promise<string | null> {
  const token = header?.match(/^Bearer\\s+(.+)$/i)?.[1];
  if (!token || !supabaseReady()) return null;
  const key = createHash('sha256').update(token).digest('hex');
  const hit = verified.get(key);
  if (hit && hit.until > Date.now()) return hit.userId;
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const check = (async () => {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    const userId = error ? null : data.user?.id ?? null;
    if (userId) {
      if (verified.size > 5000) verified.clear();
      verified.set(key, { userId, until: Date.now() + VERIFIED_MS });
    }
    return userId;
  })();
  pending.set(key, check);
  try { return await check; }
  finally { pending.delete(key); }
}
""")

# 3. Server: load the question files a little after start-up, not during the first sign-in.
r('server/src/index.ts',"""  if (questionSource() === 'files') {
    void seedFromFiles().catch(error => console.warn(`  ⚠ Could not load the reviewed questions into the bank yet: ${error instanceof Error ? error.message : error}`));""","""  if (questionSource() === 'files') {
    // Copying ~1,800 reviewed questions into the bank takes a while on a small
    // server. Wait 20 seconds so it doesn't slow the first parent who woke the
    // server up (a round started before then still waits for it).
    setTimeout(() => {
      void seedFromFiles().catch(error => console.warn(`  ⚠ Could not load the reviewed questions into the bank yet: ${error instanceof Error ? error.message : error}`));
    }, 20_000).unref();""")
print('ok')
