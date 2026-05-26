/**
 * SubscriptionsSection
 *
 * The "Subscriptions" section — recurring product orders the patient has.
 * For V1 these are entered manually (no vendor integration).
 *
 * Props:
 *   subscriptions: array of subscription objects from data.subscriptions
 */
function SubscriptionsSection({ subscriptions }) {
  const activeSubs = (subscriptions || []).filter(s => s.status !== 'cancelled')

  if (activeSubs.length === 0) {
    // For V1, don't show this section at all if there are no subscriptions.
    // No "add" CTA — subscriptions are added by Tondo manually in V1.
    return null
  }

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Subscriptions</h2>
        <span className="section-meta">{activeSubs.length}</span>
      </div>

      <ul className="subscriptions-list">
        {activeSubs.map((sub) => (
          <li key={sub.id} className="subscription-item">
            <div className="subscription-head">
              <div className="subscription-name">{sub.product_name}</div>
              <span className={`subscription-status status-${sub.status}`}>
                {sub.status}
              </span>
            </div>
            {sub.cadence && (
              <div className="subscription-cadence">{sub.cadence}</div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default SubscriptionsSection