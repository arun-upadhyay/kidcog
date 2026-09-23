import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export function supabaseReady() { return Boolean(url && serviceKey); }

export const supabaseAdmin = createClient(url || 'https://invalid.supabase.co', serviceKey || 'missing', {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function userIdFromBearer(header?: string): Promise<string | null> {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || !supabaseReady()) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}
