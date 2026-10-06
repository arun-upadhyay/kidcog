/**
 * The phones and tablets the screen-size suite checks (npm run test:screens).
 *
 * Sizes are in CSS points, the same units the app lays out in. `insets` is the
 * part of the screen the system uses: the status bar / notch / Dynamic Island
 * at the top and the home bar or navigation bar at the bottom. The suite
 * pretends these are there, so content hiding under them is caught.
 *
 * To add a device, add a line here. Keep the list to sizes people really use;
 * every device adds about a minute to a run.
 */
export type Insets = { top: number; bottom: number };
export type Device = { name: string; width: number; height: number; insets: Insets; platform: 'ios' | 'android'; tablet?: boolean };

export const DEVICES: Device[] = [
  // iPhone
  { name: 'iPhone SE (1st gen)', width: 320, height: 568, insets: { top: 20, bottom: 0 }, platform: 'ios' },
  { name: 'iPhone SE (3rd gen)', width: 375, height: 667, insets: { top: 20, bottom: 0 }, platform: 'ios' },
  { name: 'iPhone 13 mini', width: 375, height: 812, insets: { top: 50, bottom: 34 }, platform: 'ios' },
  { name: 'iPhone 16', width: 393, height: 852, insets: { top: 59, bottom: 34 }, platform: 'ios' },
  { name: 'iPhone 16 Pro Max', width: 440, height: 956, insets: { top: 62, bottom: 34 }, platform: 'ios' },
  // iPad (the app also rotates on iPad)
  { name: 'iPad mini', width: 744, height: 1133, insets: { top: 24, bottom: 20 }, platform: 'ios', tablet: true },
  { name: 'iPad Air 11', width: 820, height: 1180, insets: { top: 24, bottom: 20 }, platform: 'ios', tablet: true },
  { name: 'iPad Pro 13', width: 1032, height: 1376, insets: { top: 24, bottom: 20 }, platform: 'ios', tablet: true },
  { name: 'iPad mini landscape', width: 1133, height: 744, insets: { top: 24, bottom: 20 }, platform: 'ios', tablet: true },
  { name: 'iPad Pro 13 landscape', width: 1376, height: 1032, insets: { top: 24, bottom: 20 }, platform: 'ios', tablet: true },
  // Android (the app draws edge to edge, under the status and navigation bars)
  { name: 'Android small', width: 360, height: 640, insets: { top: 24, bottom: 48 }, platform: 'android' },
  { name: 'Pixel 8', width: 412, height: 915, insets: { top: 32, bottom: 24 }, platform: 'android' },
  { name: 'Galaxy S24 Ultra', width: 384, height: 824, insets: { top: 32, bottom: 24 }, platform: 'android' },
  { name: 'Galaxy Z Fold folded', width: 344, height: 882, insets: { top: 32, bottom: 24 }, platform: 'android' },
  { name: 'Galaxy Tab S9', width: 800, height: 1280, insets: { top: 32, bottom: 24 }, platform: 'android', tablet: true },
];
