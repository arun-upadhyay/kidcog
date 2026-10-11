/** Provider failures can arrive in the query string or fragment, before a session exists. */
export function callbackErrorFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const query = parsed.searchParams;
    const hash = new URLSearchParams(parsed.hash.slice(1));
    const value = (name: string) => query.get(name) ?? hash.get(name);
    if (!value('error') && !value('error_code') && !value('error_description')) return null;
    return describeAuthError({ code: value('error_code') ?? value('error'), message: value('error_description') });
  } catch { return null; }
}

export function describeAuthError(error: unknown): string {
  const e = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown; details?: {code?: unknown} } : {};
  const code = String(e.code ?? e.details?.code ?? '');
  const message = typeof e.message === 'string' ? e.message : '';
  if (code === 'user_banned' || /user is banned/i.test(message)) {
    return 'This account is blocked from signing in. If you requested account deletion, contact the KidCog team to restore it before permanent deletion.';
  }
  if (code === 'access_denied') return 'Sign-in was not completed. Please try again and allow KidCog to sign you in.';
  if (/flow_state|bad_code_verifier|otp_expired|pkce|bad_oauth_state/.test(code) || /code verifier|expired|already used/i.test(message)) {
    return 'This sign-in link expired or could not be verified. Start sign-in again in this browser.';
  }
  if (/over_.*rate_limit|hook_timeout/.test(code)) return 'Sign-in is temporarily unavailable. Please wait a little and try again.';
  if (code === 'provider_disabled' || code === 'oauth_provider_not_supported') return 'This sign-in option is unavailable. Please try another sign-in option.';
  // Do not echo arbitrary callback text, URLs, or tokens onto the login page.
  const safeCode = /^[a-z_]{1,64}$/.test(code) ? ` (${code})` : '';
  return `We could not complete sign-in. Please try again.${safeCode}`;
}
