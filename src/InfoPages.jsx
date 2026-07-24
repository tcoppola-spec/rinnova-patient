import { Link } from 'react-router-dom'

/**
 * InfoPages — Privacy, Terms and Help, sharing one lazy chunk.
 *
 * ⚠️ THESE DESCRIBE WHAT THE CODE ACTUALLY DOES. Every claim here was checked
 * against the implementation: the third-party list is the real set of services
 * data reaches, "no analytics" is true because there are none in the bundle,
 * and the pilot caveats are the honest state of the infrastructure. If any of
 * that changes — an analytics script, a new processor, HIPAA work — these pages
 * have to change in the same commit, or they become a lie that is worse than
 * having no policy at all.
 *
 * ⚠️ NOT LAWYER-DRAFTED. This is a plain-language description of real practice,
 * which is the honest thing to publish for a private pilot among friends. It is
 * not a substitute for review by a lawyer before Rinnova takes on patients who
 * are not friends of the founder.
 */

// The single place to change where people write in. Used by all three pages.
const CONTACT_EMAIL = 'hello@rinnova.io'

function InfoLayout({ title, updated, children }) {
  return (
    <div className="info">
      <div className="info-inner">
        <Link to="/" className="info-back">← Rinnova</Link>
        <h1 className="info-title">{title}</h1>
        {updated && <p className="info-updated">Last updated {updated}</p>}
        {children}
        <footer className="info-footer">
          Built by Tondo LLC ·{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="info-link">
            {CONTACT_EMAIL}
          </a>
        </footer>
      </div>
    </div>
  )
}

export function Privacy() {
  return (
    <InfoLayout title="Privacy" updated="July 2026">
      <p className="info-lead">
        Rinnova holds your medical history. The short version: it is yours, we
        do not sell it, and nothing about you is tracked or advertised against.
      </p>

      <h2 className="info-h2">What Rinnova stores</h2>
      <ul className="info-list">
        <li>The treatment history you add: visits, products, doses, areas, dates, cost.</li>
        <li>Photos you upload, and any notes you write on them.</li>
        <li>Your email address, and your first name if you give one.</li>
      </ul>
      <p className="info-p">
        That is all. There is no tracking of what you tap, how long you look at
        a screen, or where else you go on the internet.
      </p>

      <h2 className="info-h2">Who can see it</h2>
      <p className="info-p">
        You can. Every table is protected row by row, so one patient&apos;s
        record is unreachable from another patient&apos;s account. Photos live in
        a private store and are shown through links that expire after an hour;
        they are never publicly readable.
      </p>
      <p className="info-p">
        Being straight with you: Tondo LLC administers the database, so we can
        technically reach the data stored in it. We look only when you ask us to
        help with something, or to fix a fault. Your provider has no access at
        all, unless you show them your own screen.
      </p>

      <h2 className="info-h2">Services your data passes through</h2>
      <ul className="info-list">
        <li>
          <strong>Supabase</strong> — stores the database, photos and sign-in.
        </li>
        <li>
          <strong>Anthropic</strong> — when you photograph a note or receipt, that
          text or image is sent to Claude to be read into a structured visit.
          Under Anthropic&apos;s API terms it is not used to train their models.
        </li>
        <li>
          <strong>Netlify</strong> — hosts the app and runs the parsing function.
        </li>
        <li>
          <strong>Resend</strong> — sends your sign-in codes. Nothing else.
        </li>
        <li>
          <strong>Google Fonts</strong> — your browser fetches the two typefaces
          from Google, which means Google sees the request. No data about your
          record is involved.
        </li>
      </ul>

      <h2 className="info-h2">While Rinnova is in pilot</h2>
      <p className="info-p">
        Rinnova is not yet running on HIPAA-compliant infrastructure. That work
        comes before Rinnova takes on patients through a provider. Today it is a
        private pilot among people we know, and you should decide what to put in
        it with that in mind.
      </p>

      <h2 className="info-h2">Deleting things</h2>
      <p className="info-p">
        You can delete any visit or photo from inside the app at any time.
        Deleting a visit never deletes its photos — those are the hardest thing
        to replace, so they stay in your archive. To delete your whole account
        and everything in it, write to us and we will remove it.
      </p>

      <h2 className="info-h2">Questions</h2>
      <p className="info-p">
        Write to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="info-link">
          {CONTACT_EMAIL}
        </a>
        . A person reads it.
      </p>
    </InfoLayout>
  )
}

export function Terms() {
  return (
    <InfoLayout title="Terms" updated="July 2026">
      <p className="info-lead">
        Rinnova is a record-keeping app for aesthetic treatments, made by Tondo
        LLC. It is currently a private, invite-only pilot.
      </p>

      <h2 className="info-h2">Rinnova is not medical advice</h2>
      <p className="info-p">
        This matters more than anything else here. Rinnova describes your own
        record back to you. When it says a treatment typically lasts three to
        four months, or that you tend to return to an area twice a year, that is
        arithmetic on your history and published product ranges — not a clinical
        opinion about you.
      </p>
      <p className="info-p">
        It cannot examine you and does not know your medical situation. Decisions
        about what to have done, when, and whether at all, belong between you and
        a qualified provider.
      </p>

      <h2 className="info-h2">Your record is yours</h2>
      <p className="info-p">
        You own what you put in. We do not sell it, share it with providers or
        manufacturers, or use it for advertising. Ask and we will delete it.
      </p>

      <h2 className="info-h2">Accuracy</h2>
      <p className="info-p">
        Rinnova reads notes and receipts automatically, and it can misread them.
        It is built to leave a field blank rather than guess — an area it cannot
        place gets no dot, a dose that is not stated stays empty — but you should
        check what it saves. For anything that matters clinically, your
        provider&apos;s own chart is the authority, not this app.
      </p>

      <h2 className="info-h2">Pilot software</h2>
      <p className="info-p">
        Rinnova is provided as-is, without warranty, while it is in pilot. It may
        have faults and may change without notice. Keep your original notes and
        receipts; do not treat Rinnova as your only copy of anything you would be
        upset to lose.
      </p>

      <h2 className="info-h2">Access</h2>
      <p className="info-p">
        Access is by invitation while we pilot. Please do not upload another
        person&apos;s medical information without their consent.
      </p>

      <h2 className="info-h2">Contact</h2>
      <p className="info-p">
        Tondo LLC ·{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="info-link">
          {CONTACT_EMAIL}
        </a>
      </p>
    </InfoLayout>
  )
}

export function Help() {
  return (
    <InfoLayout title="Help">
      <h2 className="info-h2">Adding a visit</h2>
      <p className="info-p">
        Tap <strong>Log a visit</strong> and either photograph the document or
        type what you remember. Rinnova reads it and shows you what it found
        before anything is saved.
      </p>
      <p className="info-p">
        A <strong>clinical note</strong> usually names where each product went,
        so you get a full face map. A <strong>receipt</strong> is a billing
        document — it lists what you were charged for, not where it went — so
        Rinnova will ask you where each product was applied rather than guess.
        You can answer &quot;I&apos;m not sure&quot;, and it will leave the map
        empty instead of inventing one.
      </p>

      <h2 className="info-h2">Why an area has no dot</h2>
      <p className="info-p">
        Either the document never said where the product went, or the area is not
        one Rinnova can place on a face — a laser or a peel has no single point.
        It will tell you which areas it could not map. A missing dot is
        deliberate: a dot in the wrong place would quietly make your record
        wrong.
      </p>

      <h2 className="info-h2">Photos</h2>
      <p className="info-p">
        Add photos from the Photos section, or from inside a visit. Every photo
        lives in one archive; attaching it to a visit just labels it. Deleting a
        visit never deletes its photos.
      </p>

      <h2 className="info-h2">Keeping Rinnova on your home screen</h2>
      <p className="info-p">
        On iPhone, open Rinnova in Safari, tap Share, then{' '}
        <strong>Add to Home Screen</strong>. On Android and desktop Chrome, use
        the <strong>Install</strong> button on the home page.
      </p>

      <h2 className="info-h2">Getting updates</h2>
      <p className="info-p">
        When a new version is ready you will see a bar at the bottom saying so.
        Tap <strong>Refresh</strong>. That is all you need to do.
      </p>

      <h2 className="info-h2">The sign-in code did not arrive</h2>
      <p className="info-p">
        Check spam first. Codes expire after an hour, so ask for a new one if it
        has been a while. If you request several in a row you may be rate limited
        — wait a few minutes and try again.
      </p>

      <h2 className="info-h2">Something looks wrong</h2>
      <p className="info-p">
        Tell us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="info-link">
          {CONTACT_EMAIL}
        </a>
        . If a visit was read incorrectly, you can delete it and add it again.
      </p>
    </InfoLayout>
  )
}
