import { Linking, Platform } from 'react-native';

/**
 * Public web pages (privacy policy, account deletion). Google Play and the App
 * Store need these as web addresses; the phone app opens them in the browser.
 */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || 'https://kidcogvercelapp.vercel.app').replace(/\/$/, '');

/** Where parents write to about privacy or deletion. Set EXPO_PUBLIC_CONTACT_EMAIL. */
export const CONTACT_EMAIL = process.env.EXPO_PUBLIC_CONTACT_EMAIL || 'info@ritvikglobal.com';

export const COMPANY = 'Ritvik Global LLC';
export const POLICY_UPDATED = 'September 28, 2026';

/**
 * The copyright line shown in About KidCog and on the public pages. KidCog's
 * name, the Cog mascot and all artwork in the app are original work of the
 * company (see assets/BRAND.md). The year follows the clock, starting 2026.
 */
const YEAR = new Date().getFullYear();
export const COPYRIGHT = `© ${YEAR > 2026 ? `2026–${YEAR}` : '2026'} ${COMPANY}. KidCog, the Cog character and all KidCog artwork are original works of ${COMPANY}. All rights reserved.`;

export const PRIVACY_PATH = '/privacy';
export const DELETE_ACCOUNT_PATH = '/delete-account';

/** Opens a public page: in a new tab on the web, in the browser on a phone. */
export function openPublicPage(path: string) {
  const url = `${WEB_URL}${path}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(path, '_blank', 'noopener');
  else void Linking.openURL(url);
}
