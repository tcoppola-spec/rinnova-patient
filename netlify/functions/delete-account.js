import { createClient } from "@supabase/supabase-js";

/**
 * delete-account — permanently deletes the CALLING user's account and all their
 * data. Required by Apple: any app with account creation must offer in-app
 * account deletion (App Store Review Guideline 5.1.1(v)).
 *
 * WHY A SERVER FUNCTION. Deleting a Supabase auth user requires the service-role
 * key (there is no client-side "delete my own auth user"), and the service-role
 * key must never reach the browser. So the deletion runs here.
 *
 * WHOSE ACCOUNT. The caller proves identity with their own access token in the
 * Authorization header; we resolve the user id FROM that token and never accept
 * one from the request body — so this endpoint can only ever delete the caller's
 * own account, never anyone else's.
 *
 * WHAT IT DELETES, in order:
 *   1. the patient's photo FILES in Storage (a DB cascade can't touch the bucket)
 *   2. the patients row — which cascades to visits -> treatments -> treatment_areas,
 *      and to the patient's photos rows and products (all FK ON DELETE CASCADE)
 *   3. the auth user itself
 *
 * FAIL-CLOSED / OFF BY DEFAULT: if the env isn't configured it returns 500 and
 * deletes nothing.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const ANON_KEY =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL || !ANON_KEY) {
    return json(500, { error: "Not configured" });
  }

  // Identify the caller from their access token — never from the body — so this
  // can only delete the caller's own account.
  const authHeader =
    event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "Not authenticated" });

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json(401, { error: "Not authenticated" });
  }
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve the patient row so we can clean up storage + cascade the data.
  const { data: patient } = await admin
    .from("patients")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (patient?.id) {
    // 1) Storage files: <patient_id>/<uuid>.<ext>. Cascades don't reach the bucket.
    const { data: files } = await admin.storage
      .from("patient-photos")
      .list(patient.id, { limit: 1000 });
    if (files && files.length) {
      const paths = files.map((f) => `${patient.id}/${f.name}`);
      await admin.storage.from("patient-photos").remove(paths);
    }
    // 2) The patient row — cascades to visits/treatments/areas, photos, products.
    const { error: delRowErr } = await admin
      .from("patients")
      .delete()
      .eq("id", patient.id);
    if (delRowErr) {
      return json(500, { error: "Could not delete your data" });
    }
  }

  // 3) The auth user last, so a mid-way failure never leaves a signed-in user
  //    with their data already gone.
  const { error: delUserErr } = await admin.auth.admin.deleteUser(userId);
  if (delUserErr) {
    return json(500, { error: "Could not fully delete the account" });
  }

  return json(200, { deleted: true });
};
