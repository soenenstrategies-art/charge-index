#!/usr/bin/env node
/**
 * Live check of page- and file-level access: who can open which screen.
 *
 * Complements verify-rls.mjs (database rules) by requesting the real routes as
 * real signed-in users. Each user signs in through @supabase/ssr exactly as the
 * app does, and the auth cookies it sets are replayed on plain HTTP requests.
 * Creates throwaway users and data in the LIVE project, deletes them after.
 *
 *   node --env-file=.env.local scripts/verify-access.mjs                                # localhost:3000
 *   node --env-file=.env.local scripts/verify-access.mjs https://charge-index.vercel.app
 *
 * Writes the fetched .ics and .csv to $VERIFY_OUT_DIR if set, for inspection.
 * Exits non-zero if any check fails.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { unzipSync } from "fflate";

import { signInAs } from "./lib/sign-in.mjs";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error("Missing Supabase env vars — run with --env-file=.env.local");
  process.exit(2);
}

// ── Never touch the live project ───────────────────────────────────────────
// These checks create throwaway users, and on 2026-09-26 Josh saw a run's
// accounts in Jen's real client list. They now refuse to run anywhere but a
// local Supabase stack (scripts/verify-local.sh). ALLOW_LIVE=1 overrides, for
// the rare case of proving something against production on purpose — expect
// "ZZ TEST" rows to appear in the roster for the length of the run.
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(URL ?? "");
if (!isLocal && process.env.ALLOW_LIVE !== "1") {
  console.error(
    `Refusing to run against ${URL}.\n` +
      "These checks create and delete real accounts, which show up in the live\n" +
      "client roster while they run. Use scripts/verify-local.sh, which starts a\n" +
      "local Supabase stack and points both checks at it.\n" +
      "To override deliberately: ALLOW_LIVE=1 node scripts/<script>.mjs",
  );
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();
const created = [];
let failures = 0;
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`); };
const expect = (ok, m) => (ok ? pass(m) : fail(m));

async function makeUser(tag, role = "client") {
  const email = `access-check-${tag}-${stamp}@example.com`;
  const password = `AccessCheck!${stamp}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `ZZ TEST — access check (${tag})` } });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  created.push(data.user.id);
  if (role !== "client") await admin.from("profiles").update({ role }).eq("id", data.user.id);

  // Sign in the way the app does and keep the cookies it writes.
  const jar = new Map();
  const ssr = createServerClient(URL, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  await signInAs(admin, ssr, email);
  const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
  return { id: data.user.id, email, cookie };
}

// days defaults to 5 so a seeded session clears MIN_HOURS_FOR_RESULT (35) and
// the results screen generates — below that it withholds everything (Jen,
// 2026-09-24), which is checked separately below.
async function makeSession(clientId, label, shape, { wake = 8, days = 7, dayCount = 7 } = {}) {
  const sleep = (wake + shape.length) % 24;
  const { data: s, error } = await admin
    .from("tracking_sessions")
    .insert({ client_id: clientId, label, wake_time: `${String(wake).padStart(2, "0")}:00`, sleep_time: `${String(sleep).padStart(2, "0")}:00`, day_count: dayCount, status: "completed" })
    .select("id")
    .single();
  if (error) throw new Error(`session ${label}: ${error.message}`);
  const rows = [];
  for (let d = 1; d <= days; d++) shape.forEach((pct, i) => rows.push({ session_id: s.id, day_number: d, slot_hour: `${String((wake + i) % 24).padStart(2, "0")}:00`, energy_pct: pct }));
  const { error: insertError } = await admin.from("daily_entries").insert(rows);
  if (insertError) throw new Error(`entries ${label}: ${insertError.message}`);
  return s.id;
}

const buy = (clientId, sessionId, status = "completed") =>
  admin.from("purchases").insert({ client_id: clientId, session_id: sessionId, product: "basic_peak_plan", status });

async function get(path, user) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: user ? { cookie: user.cookie } : {} });
  // Read raw bytes: res.text() silently strips a UTF-8 BOM, which the CSV must keep.
  const bytes = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    type: res.headers.get("content-type") || "",
    location: res.headers.get("location") || "",
    bytes,
    body: bytes.toString("utf8"),
  };
}

try {
  console.log(`Target: ${BASE}`);
  const coach = await makeUser("coach", "coach");
  const alice = await makeUser("alice");
  const bob = await makeUser("bob");
  const carol = await makeUser("carol");

  const peakShape = [50, 100, 100, 75, 50, 25]; // 8 AM–2 PM: peak 9–11 AM
  const lowShape = [50, 50, 25, 25, 50, 50]; // no peak window
  const alicePaid = await makeSession(alice.id, "Alice paid", peakShape);
  const aliceUnpaid = await makeSession(alice.id, "Alice unpaid", peakShape);
  const bobSession = await makeSession(bob.id, "Bob pending", peakShape);
  const carolSession = await makeSession(carol.id, "Carol no peak", lowShape);
  await buy(alice.id, alicePaid);
  await buy(bob.id, bobSession, "pending");
  await buy(carol.id, carolSession);

  console.log("\nSigned out");
  for (const path of [`/plan/${alicePaid}`, `/plan/${alicePaid}/peak-plan.ics`, `/coach/sessions/${alicePaid}/export.csv`]) {
    const r = await get(path);
    expect(r.status === 307 && r.location.includes("/login"), `${path.split("/").slice(0, 2).join("/")}… redirects to login (${r.status})`);
  }

  console.log("\nThe forgotten-password pages (2026-10-11)");
  // /forgot-password has to be reachable with no session at all — the people
  // who need it are by definition locked out.
  r = await get("/forgot-password");
  expect(r.status === 200, "a signed-out visitor can open /forgot-password");
  expect(/Forgot your password/i.test(r.body), "the sign-in screen's link target renders its form");
  // /reset-password must NOT be: the session the emailed link establishes is
  // the only proof the person owns the mailbox. A stale link means no session,
  // and no session has to mean no password change.
  r = await get("/reset-password");
  expect(
    r.status === 307 && r.location.includes("/login"),
    "a signed-out visitor is refused /reset-password and sent to login",
  );
  // Someone already signed in may change their password at any time.
  r = await get("/reset-password", alice);
  expect(r.status === 200, "a signed-in client can open /reset-password to change their password");

  console.log("\nClient without a purchase");
  let r = await get(`/plan/${aliceUnpaid}`, alice);
  expect(r.status === 404, "own session's plan without a purchase is 404");
  r = await get(`/plan/${aliceUnpaid}/peak-plan.ics`, alice);
  expect(r.status === 404, "own session's calendar file without a purchase is 404");
  r = await get(`/track/${aliceUnpaid}/complete`, alice);
  expect(r.status === 200 && r.body.includes("Unlock my plan") && !r.body.includes("View my Peak Plan"), "results screen still offers the locked plan card");

  console.log("\nClient with a completed purchase for this session");
  r = await get(`/plan/${alicePaid}`, alice);
  expect(r.status === 200 && r.body.includes("Your charged schedule"), "plan opens");
  expect(r.body.includes("Nothing books over 9 AM – 11 AM"), "plan guards the computed peak window");
  r = await get(`/plan/${alicePaid}/peak-plan.ics`, alice);
  expect(r.status === 200 && r.type.startsWith("text/calendar") && r.body.startsWith("BEGIN:VCALENDAR"), "calendar file downloads");
  if (process.env.VERIFY_OUT_DIR) writeFileSync(join(process.env.VERIFY_OUT_DIR, "peak-plan.ics"), r.bytes);
  r = await get(`/track/${alicePaid}/complete`, alice);
  expect(r.body.includes("View my Peak Plan"), "results screen links to the plan");
  r = await get(`/coach/sessions/${alicePaid}/export.csv`, alice);
  expect(r.status === 404, "client cannot download the coach CSV, even for own session");

  console.log("\nToo little data to generate anything");
  // A separate client, so the bulk-export counts below stay predictable.
  const thin = await makeUser("thin");
  const thinSession = await makeSession(thin.id, "Thin week", peakShape, { days: 2, dayCount: 5 });
  await buy(thin.id, thinSession);
  r = await get(`/track/${thinSession}/complete`, thin);
  expect(r.status === 200 && r.body.includes("Not enough hours yet"), "a session under 35 hours says so");
  expect(!r.body.includes("Your peak hours"), "and names no peak hours");
  expect(!r.body.includes("Unlock my plan") && !r.body.includes("View my Peak Plan"), "and offers no plan, even to a client who has paid");

  console.log("\nOther clients");
  r = await get(`/plan/${bobSession}`, bob);
  expect(r.status === 404, "a pending purchase doesn't unlock the plan");
  r = await get(`/plan/${alicePaid}`, bob);
  expect(r.status === 404, "another client's paid plan is 404");
  r = await get(`/plan/${alicePaid}/peak-plan.ics`, bob);
  expect(r.status === 404, "another client's calendar file is 404");
  r = await get(`/track/${alicePaid}/complete`, bob);
  expect(r.status === 404, "another client's results screen is 404");
  r = await get(`/plan/${carolSession}`, carol);
  expect(r.status === 200 && r.body.includes("No peak window yet"), "paid plan with no peak window opens and says so");
  r = await get(`/plan/${carolSession}/peak-plan.ics`, carol);
  expect(r.status === 404, "no calendar file when there's no peak window to protect");
  r = await get("/coach", carol);
  expect(r.status === 404, "client can't open the coach roster");

  console.log("\nCoach");
  r = await get(`/coach/sessions/${alicePaid}`, coach);
  expect(r.status === 200 && r.body.includes("Charge curve"), "coach session page renders the analysis");
  r = await get(`/coach/sessions/${alicePaid}`, alice);
  expect(r.status === 404 && !r.body.includes("Charge curve"), "client can't open the coach session page for their own session");
  r = await get(`/plan/${bobSession}`, coach);
  expect(r.status === 200, "coach opens any plan, purchased or not");
  r = await get(`/coach/sessions/${alicePaid}/export.csv`, coach);
  expect(r.status === 200 && r.type.startsWith("text/csv") && r.body.startsWith("﻿"), "coach downloads the CSV");
  expect(r.body.includes(alice.email), "CSV carries the client's email");
  if (process.env.VERIFY_OUT_DIR) writeFileSync(join(process.env.VERIFY_OUT_DIR, "session.csv"), r.bytes);
  const singleCsv = r.bytes;

  console.log("\nRoster and client pages");
  r = await get("/coach", coach);
  expect(r.status === 200 && r.body.includes("Clients") && r.body.includes("access-check-alice"), "coach roster lists clients with emails");
  r = await get("/coach?q=carol", coach);
  expect(r.body.includes("access-check-carol") && !r.body.includes("access-check-bob"), "roster search filters by name or email");
  r = await get(`/coach/clients/${alice.id}`, coach);
  expect(r.status === 200 && r.body.includes("Alice paid") && r.body.includes("Coach notes"), "coach opens a client page with sessions and notes");
  r = await get(`/coach/clients/${coach.id}`, coach);
  expect(r.status === 404, "a coach who hasn't tracked anything has no client page");
  const tracker = await makeUser("tracker", "admin");
  await makeSession(tracker.id, "Admin tracks too", peakShape);
  r = await get("/coach", coach);
  expect(r.body.includes("access-check-tracker"), "an admin who has tracked a session appears on the roster");
  r = await get(`/coach/clients/${tracker.id}`, coach);
  expect(r.status === 200 && r.body.includes("Admin tracks too"), "and has a client page with their sessions");
  r = await get(`/coach/sessions/${alicePaid}`, coach);
  expect(r.body.includes("Daily log") && r.body.includes("Clients") && !r.body.includes("All sessions"), "coach session page shows the daily log, and no all-sessions tab");
  for (const path of [`/coach/clients/${alice.id}`, `/coach/clients/${alice.id}/summary.csv`, `/coach/clients/${alice.id}/sessions.zip`, "/coach/export/sessions.csv"]) {
    r = await get(path, alice);
    expect(r.status === 404, `client gets 404 for ${path.replace(alice.id, "<own id>")}`);
  }

  console.log("\nBulk exports");
  r = await get(`/coach/clients/${alice.id}/sessions.zip`, coach);
  expect(r.status === 200 && r.type === "application/zip", "per-client ZIP downloads");
  const zipped = unzipSync(new Uint8Array(r.bytes));
  const names = Object.keys(zipped);
  expect(names.length === 2, `ZIP holds one CSV per session (${names.length})`);
  const paidFile = names.find((n) => n.includes("Alice_paid"));
  expect(!!paidFile && Buffer.from(zipped[paidFile]).equals(singleCsv), "a CSV inside the ZIP is byte-identical to the single-session download");

  // Past the API's 1,000-row default: 8 sessions × 7 days × 20 hours = 1,120 entries.
  const bulkShape = Array.from({ length: 20 }, (_, i) => [100, 75, 50, 25, 10][i % 5]);
  for (let i = 1; i <= 8; i++) await makeSession(bob.id, `Bulk ${i}`, bulkShape, { wake: 4, days: 7, dayCount: 7 });
  r = await get(`/coach/clients/${bob.id}/summary.csv`, coach);
  const rows = r.body.replace(/^\uFEFF/, "").trimEnd().split("\r\n").slice(1).map((l) => l.match(/"((?:[^"]|"")*)"/g).map((c) => c.slice(1, -1)));
  const loggedTotal = rows.reduce((sum, cells) => sum + Number(cells[7]), 0);
  expect(r.status === 200 && rows.length === 9, `client summary CSV has a row per session (${rows.length})`);
  // Bob's own session adds 7 days × 6 hours on top of the bulk 1,120.
  expect(loggedTotal === 1120 + 42, `summary counts every entry past the 1,000-row cap (${loggedTotal} of 1162)`);
  r = await get("/coach/export/sessions.csv", coach);
  const allRows = r.body.split("\r\n").filter((l) => l.includes("access-check-") && l.includes(String(stamp)));
  expect(r.status === 200 && allRows.length === 14, `all-sessions export includes every test session (${allRows.length} of 14)`);
} catch (error) {
  fail(`script error: ${error.message}`);
} finally {
  console.log("\nCleanup");
  for (const id of created) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) fail(`delete ${id}: ${error.message}`);
  }
  const { count } = await admin
    .from("purchases")
    .select("*", { count: "exact", head: true })
    .in("client_id", created.length ? created : ["00000000-0000-0000-0000-000000000000"]);
  expect(count === 0, `deleted ${created.length} test users, their sessions and purchases`);
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}
