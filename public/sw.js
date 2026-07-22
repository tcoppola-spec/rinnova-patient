/**
 * Rinnova service worker.
 *
 * Two jobs:
 *   1. Make the app INSTALLABLE. Chrome/Edge/Android only offer installation
 *      when a service worker with a fetch handler is registered alongside a
 *      valid manifest. Without this file there is no install prompt anywhere
 *      except iOS's manual Add to Home Screen.
 *   2. Make a launch survive a bad network. An installed app that shows a
 *      browser error page when the signal drops doesn't feel like an app.
 *
 * ⚠️ THE RISK THIS INTRODUCES, AND HOW IT'S CONTAINED.
 * Until now Rinnova had NO service worker, which is why "just reopen it" always
 * got the newest code — every launch hit the network. A cache changes that, and
 * a badly-written one strands people on an old build permanently, which is far
 * worse than having no offline support. So:
 *
 *   - Navigations are NETWORK-FIRST. The HTML is only served from cache when
 *     the network actually fails. Fresh HTML means fresh (content-hashed)
 *     asset URLs, so a new deploy lands on the next launch.
 *   - skipWaiting + clients.claim, so an updated worker takes over immediately
 *     instead of waiting for every tab to close.
 *   - Only same-origin GETs are cached, and only static assets.
 *
 * ⚠️ NEVER cache these — it would serve one patient's data to another, or
 * silently return stale medical records:
 *   - Supabase (cross-origin: auth, database, storage signed URLs)
 *   - /.netlify/functions/* (the AI parser)
 *   - anything that isn't a GET
 *
 * Bump CACHE_VERSION to force old caches out on the next activation.
 */

const CACHE_VERSION = 'v2'
const CACHE_NAME = `rinnova-${CACHE_VERSION}`

// The shell needed to render something useful offline. Deliberately tiny and
// hand-listed: the JS/CSS bundles are content-hashed at build time, so they
// can't be named here — they get cached on first use instead.
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Individually, so one 404 can't fail the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

/**
 * Content-hashed build output. Cache-first is safe here and ONLY here: Vite
 * puts the content hash in the filename, so a changed file is a different URL
 * and a cached one can never be stale.
 */
function isHashedAsset(url) {
  return url.pathname.startsWith('/assets/')
}

/**
 * Static files that change IN PLACE at the same URL: icons, the favicon, the
 * manifest.
 *
 * ⚠️ These must NOT be cache-first. v1 of this worker treated every .svg and
 * .png that way, which pinned the old favicon on every device that had loaded
 * the site — a new one was deployed and simply never appeared, with no way for
 * the user to fix it short of clearing site data. Same URL, new bytes, cached
 * forever is the whole failure mode.
 *
 * Network-first with a cache fallback: fresh whenever there's a connection,
 * still available offline.
 */
function isStaticAsset(url) {
  return (
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname === '/manifest.webmanifest'
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Cross-origin (Supabase, Google Fonts) and serverless functions: stay out of
  // the way entirely. Patient data must never sit in a cache.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/.netlify/')) return

  // Navigations: network-first, cache only as an offline fallback. This is what
  // keeps deploys landing — see the note at the top.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/').then((cached) => cached || Response.error()))
    )
    return
  }

  // Hashed build output: cache-first. A changed file has a different URL.
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
      })
    )
    return
  }

  // Icons, favicon, manifest: network-first, because these change in place at
  // a stable URL. Cache is the offline fallback, never the source of truth.
  if (isStaticAsset(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
  }
})
