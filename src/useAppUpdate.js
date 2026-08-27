import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * useAppUpdate — "is the app I am running older than the one being served?"
 *
 * Compares the build id compiled into this bundle (vite.config.js) against
 * /version.json, which is written fresh on every deploy.
 *
 * WHY THIS EXISTS. Rinnova is installed to home screens, and an installed app
 * is rarely reloaded — it gets backgrounded and reopened, so it can keep
 * running a build from days ago with no sign that anything moved. Before this
 * the only fix was knowing to fully quit and relaunch, twice.
 *
 * WHY IT IS QUIET. The check only reports true when the running build genuinely
 * differs from the deployed one. A fresh launch already has the newest bundle
 * (navigations are network-first), so nothing appears — the bar shows up only
 * when someone is actually on a stale version. A banner that appeared after
 * every deploy, including on launches that already had the new code, would be
 * noise and would train people to ignore it.
 *
 * Checked on mount and whenever the app is brought back to the foreground,
 * which for a PWA is exactly the moment someone returns to it. No polling: a
 * timer would burn battery to answer a question that only matters when the
 * patient is actually looking.
 *
 * Failures are silent by design. Offline, a blocked request, a malformed
 * response: all mean "no answer", never "update available".
 */
export function useAppUpdate() {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    // Dev serves no version.json, and the service worker is production-only.
    if (!import.meta.env.PROD) return
    // Native app: updates ship through TestFlight / the App Store, not a page
    // reload. The bundled build id will never match the live version.json, so
    // this check would show a "Refresh" banner that can never resolve.
    if (Capacitor.isNativePlatform()) return

    let cancelled = false

    async function check() {
      // Already flagged: stop asking. The banner does not need confirming, and
      // the answer cannot become false without a reload.
      if (cancelled || updateReady) return
      try {
        const res = await fetch('/version.json', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data?.version && data.version !== __APP_VERSION__) {
          setUpdateReady(true)
        }
      } catch {
        // Offline or unreachable. Say nothing.
      }
    }

    check()

    function onVisible() {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [updateReady])

  return updateReady
}

/**
 * Reload onto the newest build.
 *
 * The reload alone is what actually updates the app: navigations are
 * network-first, so it fetches fresh HTML and therefore the new bundle.
 *
 * Telling a waiting service worker to step aside first is a courtesy — it lets
 * the new worker's cache take over rather than waiting for every client to
 * close. It is best-effort and never blocks the reload: if that hangs or
 * throws, the patient still gets the new version.
 */
export async function applyAppUpdate() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.()
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
  } catch {
    // Not fatal — the reload below is what matters.
  }
  window.location.reload()
}
