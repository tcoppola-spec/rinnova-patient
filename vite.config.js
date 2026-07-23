import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * A build identity, baked into the bundle AND written to /version.json.
 *
 * This is what lets a running app notice that a newer one has been deployed
 * (src/useAppUpdate.js): it compares the version it was built with against the
 * one currently being served.
 *
 * WHY NOT USE THE SERVICE WORKER for this. The obvious approach is the standard
 * "waiting worker" update prompt, but public/sw.js is a static file: it only
 * changes when someone edits it, so an ordinary content deploy would not fire
 * an update event at all. The prompt would stay silent exactly when it matters.
 *
 * The commit SHA rather than a timestamp, so the id changes when the CODE
 * changes. Netlify rebuilding the same commit (a retry, a cleared cache) would
 * otherwise announce a phantom update. Falls back to a timestamp so a build can
 * never fail merely because git is unavailable.
 */
function resolveBuildId() {
  if (process.env.COMMIT_REF) return process.env.COMMIT_REF.slice(0, 12) // Netlify
  try {
    return execSync('git rev-parse --short=12 HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return `t${Date.now()}`
  }
}

const BUILD_ID = resolveBuildId()

/**
 * Writes /version.json beside the bundle, holding the same id compiled into it.
 * Deliberately a tiny standalone file rather than something parsed out of
 * index.html: it is one small fetch, and the service worker leaves it alone
 * (it is neither a hashed asset nor an icon), so the answer is always live.
 */
function emitVersionFile() {
  return {
    name: 'rinnova-emit-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: BUILD_ID }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), emitVersionFile()],
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_ID),
  },
})
