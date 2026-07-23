import { useState } from 'react'
import { useAppUpdate, applyAppUpdate } from './useAppUpdate'

/**
 * UpdateBanner — "Update available · Refresh".
 *
 * Appears only when the running build is genuinely older than the deployed one
 * (see useAppUpdate). An installed app is rarely reloaded, so without this the
 * only way onto a new version is knowing to fully quit and relaunch.
 *
 * Deliberately NOT dismissible. It is one line, it appears rarely, and it
 * describes a condition the patient can fix in one tap — a close button would
 * only let someone stay on an old version while believing they are current.
 *
 * Pinned to the bottom, clear of the notch and above the home indicator: the
 * top of the app is the greeting and the insight, and a bar dropping in there
 * would shove the whole page down as you read it.
 */
function UpdateBanner() {
  const updateReady = useAppUpdate()
  const [refreshing, setRefreshing] = useState(false)

  if (!updateReady) return null

  function handleRefresh() {
    setRefreshing(true)
    applyAppUpdate()
  }

  return (
    <div className="update-banner" role="status">
      <span className="update-banner-text">A new version of Rinnova is ready</span>
      <button
        type="button"
        className="update-banner-btn"
        onClick={handleRefresh}
        disabled={refreshing}
      >
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  )
}

export default UpdateBanner
