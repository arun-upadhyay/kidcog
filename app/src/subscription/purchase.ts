/**
 * Where the actual payment will plug in.
 *
 * Not connected yet. The plan is RevenueCat (react-native-purchases) for the
 * App Store and Google Play, and RevenueCat Web Billing (Stripe) on the
 * website, with the parent's Supabase user ID as the RevenueCat user ID.
 * RevenueCat's webhook then sets account_usage.premium_until on the server,
 * which is what actually unlocks everything — the app never decides.
 *
 * Until then the Plans sheet says the early-supporter plan opens soon.
 */
export type PurchaseResult = { ok: true } | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed'; message?: string };

export const purchaseAvailable = false;

export async function startEarlySupporterPurchase(): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}

export async function restorePurchases(): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}
