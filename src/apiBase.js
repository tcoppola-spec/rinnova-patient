import { Capacitor } from '@capacitor/core'

/**
 * apiUrl — resolve a same-origin backend path to a URL that works in BOTH
 * the browser and the native iOS shell.
 *
 * In the browser (app.rinnova.io) the Netlify Functions and version.json are
 * same-origin, so a relative path like "/.netlify/functions/parse-visit" is
 * correct and stays relative.
 *
 * Inside the bundled native app the web assets load from capacitor://localhost,
 * so that same relative path would hit the DEVICE, not our backend — AI parsing
 * would silently fail. On native we therefore prefix the real origin.
 *
 * This is the ONLY origin difference between web and native: Supabase already
 * uses an absolute URL (VITE_SUPABASE_URL), so its calls need no change.
 *
 * If the production domain ever moves, change NATIVE_ORIGIN (and ship a new
 * native build — the origin is baked into the binary).
 */
const NATIVE_ORIGIN = 'https://app.rinnova.io'

export function apiUrl(path) {
  return Capacitor.isNativePlatform() ? `${NATIVE_ORIGIN}${path}` : path
}
