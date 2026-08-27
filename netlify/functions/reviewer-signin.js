import { createClient } from "@supabase/supabase-js";

/**
 * reviewer-signin — a scoped sign-in for Apple's App Review only.
 *
 * WHY THIS EXISTS. Rinnova is invite-only (the allowlist) and signs in with an
 * emailed one-time code. An App Review / TestFlight beta reviewer has no way to
 * receive that code, so they can't get past the login screen — and a reviewer
 * who can't open the app rejects the build. This gives them ONE working way in.
 *
 * WHAT IT DOES. If (and only if) the request carries the exact reviewer email
 * AND the secret reviewer code (both configured as Netlify env vars, so they
 * never live in the shipped bundle), it uses the Supabase SERVICE ROLE key —
 * server-side only, never exposed — to mint a real session for the ONE demo
 * account and returns it. The client then adopts that session like any other.
 *
 * BLAST RADIUS. This endpoint can only ever sign into the single reviewer demo
 * account (REVIEWER_EMAIL). It cannot touch, name, or reach any other patient —
 * RLS isolates each patient by auth_user_id exactly as for a normal sign-in.
 * The worst case if the code leaked is that a stranger sees an empty demo
 * record. The service-role key stays on the server.
 *
 * FAIL-CLOSED / OFF BY DEFAULT. If any of the three env vars is unset, the
 * endpoint is disabled (returns 404). So it does nothing until deliberately
 * configured, and can be turned off after launch by clearing the env vars.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const REVIEWER_EMAIL = process.env.REVIEWER_EMAIL;
  const REVIEWER_CODE = process.env.REVIEWER_CODE;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const ANON_KEY =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  // Off unless fully configured — the endpoint simply doesn't exist otherwise.
  if (!REVIEWER_EMAIL || !REVIEWER_CODE || !SERVICE_ROLE_KEY || !SUPABASE_URL) {
    return json(404, { error: "Not found" });
  }

  let email, code;
  try {
    ({ email, code } = JSON.parse(event.body || "{}"));
  } catch {
    return json(400, { error: "Bad request" });
  }

  // Only the exact reviewer email + secret code get in. Same neutral rejection
  // for a wrong email and a wrong code, so this leaks nothing.
  const emailOk =
    typeof email === "string" &&
    email.trim().toLowerCase() === REVIEWER_EMAIL.trim().toLowerCase();
  const codeOk = typeof code === "string" && code.trim() === REVIEWER_CODE.trim();
  if (!emailOk || !codeOk) {
    return json(401, { error: "Not authorized" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Ensure the demo user exists. createUser fires the allowlist trigger, so the
  // reviewer email must be on allowed_emails (it provisions an empty patient row
  // just like any tester). If it already exists, ignore the duplicate error.
  const created = await admin.auth.admin.createUser({
    email: REVIEWER_EMAIL,
    email_confirm: true,
  });
  if (
    created.error &&
    !/already|registered|exists/i.test(created.error.message || "")
  ) {
    return json(500, { error: "Could not prepare the review account" });
  }

  // Mint an OTP for that user, then redeem it server-side into a real session,
  // so the one-time code never leaves the server.
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: REVIEWER_EMAIL,
  });
  const otp = link?.data?.properties?.email_otp;
  if (link.error || !otp) {
    return json(500, { error: "Could not start the review session" });
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // The verify type for a generated magic-link OTP has varied across GoTrue
  // versions; try 'email' then 'magiclink' so this doesn't hinge on it.
  let verified = await anon.auth.verifyOtp({
    email: REVIEWER_EMAIL,
    token: otp,
    type: "email",
  });
  if (verified.error) {
    verified = await anon.auth.verifyOtp({
      email: REVIEWER_EMAIL,
      token: otp,
      type: "magiclink",
    });
  }
  const session = verified?.data?.session;
  if (verified.error || !session) {
    return json(500, { error: "Could not complete the review session" });
  }

  return json(200, {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
};
