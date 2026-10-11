#!/usr/bin/env node
/**
 * Live check of the database's access rules (RLS + column privileges).
 *
 * Creates throwaway users against the REAL Supabase project, tries every
 * access path that matters — clients against each other, a client against
 * the coach role, a coach against client data — then deletes everything it
 * made. Run after any migration or policy change:
 *
 *   node --env-file=.env.local scripts/verify-rls.mjs
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY. Exits non-zero if any check fails.
 */
import { createClient } from "@supabase/supabase-js";

import { signInAs } from "./lib/sign-in.mjs";

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

const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};
const expect = (ok, msg) => (ok ? pass(msg) : fail(msg));
const denied = (res) => !!res.error && res.error.code === "42501";

async function makeUser(tag, role = "client") {
  const email = `rls-check-${tag}-${stamp}@example.com`;
  const password = `RlsCheck!${stamp}${tag}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Obvious on sight: these live for under a minute, but a coach refreshing
    // the roster mid-run shouldn't wonder who they are (Josh, 2026-09-26).
    user_metadata: { full_name: `ZZ TEST — access check (${tag})` },
  });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  created.push(data.user.id);
  if (role !== "client") {
    await admin.from("profiles").update({ role }).eq("id", data.user.id);
  }
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  await signInAs(admin, client, email);
  return { id: data.user.id, email, db: client };
}

async function seedSession(user) {
  const { data: session } = await user.db
    .from("tracking_sessions")
    .insert({ client_id: user.id, label: "rls-check", wake_time: "06:00", sleep_time: "22:00", day_count: 5 })
    .select("id")
    .single();
  await user.db.from("daily_entries").insert({ session_id: session.id, day_number: 1, slot_hour: "09:00", energy_pct: 75 });
  await user.db.from("daily_notes").insert({ session_id: session.id, day_number: 1, for_jen_note: "private" });
  await admin.from("session_analysis").insert({ session_id: session.id, windows: {} });
  // Tied to this session: both canViewPeakPlan() and has_peak_plan() match on
  // session_id, so a purchase without one unlocks nothing.
  await admin.from("purchases").insert({ client_id: user.id, session_id: session.id, product: "basic_peak_plan", status: "completed" });
  return session.id;
}

const count = async (db, table, column, value) => {
  const { data } = await db.from(table).select(column).eq(column, value);
  return data?.length ?? 0;
};

try {
  const alice = await makeUser("alice");
  const bob = await makeUser("bob");
  const coach = await makeUser("coach", "coach");
  const aliceSession = await seedSession(alice);

  console.log("\nProfiles — no self-promotion");
  const { data: aliceProfile } = await admin.from("profiles").select("role, full_name").eq("id", alice.id).single();
  expect(aliceProfile?.role === "client" && aliceProfile?.full_name?.includes("alice"), "signup trigger creates a client profile with the name");
  expect(denied(await alice.db.from("profiles").update({ role: "coach" }).eq("id", alice.id)), "client cannot set own role");
  expect(denied(await alice.db.from("profiles").update({ role: "admin", full_name: "x" }).eq("id", alice.id)), "client cannot smuggle role alongside a name change");
  expect(denied(await alice.db.from("profiles").update({ stripe_customer_id: "cus_forged" }).eq("id", alice.id)), "client cannot set own stripe_customer_id");
  expect(!(await alice.db.from("profiles").update({ full_name: "ZZ TEST — access check (alice)" }).eq("id", alice.id)).error, "client can still change own name");
  const { data: withEmail } = await admin.from("profiles").select("email").eq("id", alice.id).single();
  expect(withEmail?.email === alice.email, "signup trigger copies the account email onto the profile");
  expect(denied(await alice.db.from("profiles").update({ email: "spoofed@example.com" }).eq("id", alice.id)), "client cannot overwrite the email on their profile");
  const changedEmail = `rls-check-changed-${stamp}@example.com`;
  await admin.auth.admin.updateUserById(alice.id, { email: changedEmail, email_confirm: true });
  const { data: afterChange } = await admin.from("profiles").select("email").eq("id", alice.id).single();
  expect(afterChange?.email === changedEmail, "changing the account email updates the profile");
  expect((await bob.db.from("profiles").select("id")).data?.length === 1, "client sees only their own profile");

  console.log("\nClient ↔ client");
  expect((await count(bob.db, "tracking_sessions", "id", aliceSession)) === 0, "bob cannot read alice's session");
  expect((await count(bob.db, "daily_entries", "session_id", aliceSession)) === 0, "bob cannot read alice's entries");
  expect((await count(bob.db, "daily_notes", "session_id", aliceSession)) === 0, "bob cannot read alice's reflections");
  expect((await count(bob.db, "purchases", "client_id", alice.id)) === 0, "bob cannot read alice's purchases");
  expect(denied(await bob.db.from("daily_entries").insert({ session_id: aliceSession, day_number: 2, slot_hour: "10:00", energy_pct: 10 })), "bob cannot write entries into alice's session");
  expect(denied(await bob.db.from("tracking_sessions").insert({ client_id: alice.id, wake_time: "06:00", sleep_time: "22:00", day_count: 5 })), "bob cannot create a session owned by alice");
  await bob.db.from("tracking_sessions").update({ status: "completed" }).eq("id", aliceSession);
  expect((await admin.from("tracking_sessions").select("status").eq("id", aliceSession).single()).data?.status === "in_progress", "bob cannot modify alice's session");

  console.log("\nClient → coach-only and paid data");
  expect((await count(alice.db, "session_analysis", "session_id", aliceSession)) === 0, "client reads no session_analysis, even for own session");
  expect(denied(await alice.db.from("purchases").insert({ client_id: alice.id, product: "peak_plan_session", status: "completed" })), "client cannot grant themselves a purchase");
  expect((await count(alice.db, "purchases", "client_id", alice.id)) === 1, "client can read their own purchase");

  console.log("\nCoach");
  expect((await count(coach.db, "tracking_sessions", "id", aliceSession)) === 1, "coach reads a client's session");
  expect((await count(coach.db, "daily_entries", "session_id", aliceSession)) === 1, "coach reads a client's entries");
  expect((await count(coach.db, "daily_notes", "session_id", aliceSession)) === 1, "coach reads a client's reflections");
  expect((await count(coach.db, "session_analysis", "session_id", aliceSession)) === 1, "coach reads session_analysis");
  expect((await coach.db.from("profiles").select("id").in("id", [alice.id, bob.id])).data?.length === 2, "coach reads client profiles");
  expect(denied(await coach.db.from("profiles").update({ role: "admin" }).eq("id", coach.id)), "coach cannot change roles either");

  console.log("\nCoach notes");
  const coach2 = await makeUser("coach2", "coach");
  const { data: note, error: noteError } = await coach.db.from("coach_notes").insert({ client_id: alice.id, body: "Private note about alice" }).select("id, author_id").single();
  expect(!noteError && note?.author_id === coach.id, "coach can write a note, stamped with their own id");
  expect(denied(await coach.db.from("coach_notes").insert({ client_id: alice.id, author_id: coach2.id, body: "forged author" })), "coach cannot write a note as another coach");
  expect((await count(coach2.db, "coach_notes", "client_id", alice.id)) === 1, "another coach can read the note");
  await coach2.db.from("coach_notes").delete().eq("id", note.id);
  await coach2.db.from("coach_notes").update({ body: "tampered" }).eq("id", note.id);
  const { data: noteAfter } = await admin.from("coach_notes").select("body").eq("id", note.id).single();
  expect(noteAfter?.body === "Private note about alice", "another coach cannot edit or delete it");
  expect((await count(alice.db, "coach_notes", "client_id", alice.id)) === 0, "the client cannot read notes about themselves");
  expect(denied(await alice.db.from("coach_notes").insert({ client_id: alice.id, body: "client note" })), "a client cannot write coach notes");
  expect(!(await coach.db.from("coach_notes").delete().eq("id", note.id)).error && (await count(admin, "coach_notes", "id", note.id)) === 0, "the author can delete their note");

  console.log("\nReminder log");
  await admin.from("reminder_log").insert({ session_id: aliceSession, day_number: 1, reminder_key: "rls-check" });
  expect((await count(coach.db, "reminder_log", "session_id", aliceSession)) === 1, "coach can read the reminder log");
  expect((await count(alice.db, "reminder_log", "session_id", aliceSession)) === 0, "client cannot read the reminder log, even for their own session");
  expect(denied(await alice.db.from("reminder_log").insert({ session_id: aliceSession, day_number: 2, reminder_key: "forged" })), "client cannot write the reminder log");
  expect(denied(await coach.db.from("reminder_log").insert({ session_id: aliceSession, day_number: 2, reminder_key: "forged" })), "coach cannot write the reminder log either (server-only)");
  console.log("\nThe 24-hour logging window");
  // Sessions here have no timezone, so the rule runs on UTC. Slots are built
  // around the hour it is right now, which keeps the checks true at any time
  // of day — including the awkward ones near midnight.
  const utcHour = new Date().getUTCHours();
  const slot = (h) => `${String(((h % 24) + 24) % 24).padStart(2, "0")}:00`;
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const madeSession = async (client, startDate) =>
    (
      await admin
        .from("tracking_sessions")
        .insert({ client_id: client.id, label: "rls-check", wake_time: "00:00", sleep_time: "23:00", day_count: 5, start_date: startDate })
        .select("id")
        .single()
    ).data;

  const todaySession = await madeSession(alice, daysAgo(0));
  expect(
    !(await alice.db.from("daily_entries").insert({ session_id: todaySession.id, day_number: 1, slot_hour: slot(utcHour), energy_pct: 50 })).error,
    "client can log the hour they're in",
  );
  if (utcHour < 23) {
    expect(
      denied(await alice.db.from("daily_entries").insert({ session_id: todaySession.id, day_number: 1, slot_hour: slot(utcHour + 1), energy_pct: 50 })),
      "client cannot log an hour that hasn't happened",
    );
  }
  expect(
    denied(await alice.db.from("daily_entries").insert({ session_id: todaySession.id, day_number: 2, slot_hour: slot(utcHour), energy_pct: 100 })),
    "client cannot log a day that hasn't arrived",
  );

  // Two days in: day 3 is today, day 2 was yesterday, day 1 is two days back.
  const oldSession = await madeSession(alice, daysAgo(2));
  expect(
    !(await alice.db.from("daily_entries").insert({ session_id: oldSession.id, day_number: 3, slot_hour: slot(utcHour), energy_pct: 75 })).error,
    "today's hours are open",
  );
  if (utcHour < 23) {
    expect(
      !(await alice.db.from("daily_entries").insert({ session_id: oldSession.id, day_number: 2, slot_hour: slot(utcHour + 1), energy_pct: 75 })).error,
      "so is the same hour yesterday, within 24 hours",
    );
  }
  if (utcHour > 0) {
    expect(
      denied(await alice.db.from("daily_entries").insert({ session_id: oldSession.id, day_number: 2, slot_hour: slot(utcHour - 1), energy_pct: 75 })),
      "yesterday's earlier hours have closed",
    );
  }
  expect(
    denied(await alice.db.from("daily_entries").insert({ session_id: oldSession.id, day_number: 1, slot_hour: slot(utcHour), energy_pct: 75 })),
    "and two days ago is long shut",
  );
  expect(
    denied(await alice.db.from("daily_notes").insert({ session_id: oldSession.id, day_number: 1, feel_note: "late" })),
    "a reflection closes with its day",
  );

  console.log("\nJen can edit a client's entries");
  expect(
    !(await coach.db.from("daily_entries").insert({ session_id: oldSession.id, day_number: 1, slot_hour: slot(utcHour), energy_pct: 25 })).error,
    "a coach can write an hour the client can no longer reach",
  );
  expect(
    !(await coach.db.from("daily_entries").delete().match({ session_id: oldSession.id, day_number: 1, slot_hour: slot(utcHour) })).error,
    "and clear one",
  );
  expect(
    denied(await bob.db.from("daily_entries").insert({ session_id: oldSession.id, day_number: 3, slot_hour: slot(utcHour), energy_pct: 100 })),
    "another client still cannot touch it",
  );

  console.log("\nOne Charge Index per client");
  expect(denied(await bob.db.from("tracking_sessions").insert({ client_id: bob.id, label: "rls-check", wake_time: "06:00", sleep_time: "22:00", day_count: 5 })) === false, "a client's first session is allowed");
  expect(denied(await bob.db.from("tracking_sessions").insert({ client_id: bob.id, label: "rls-check", wake_time: "06:00", sleep_time: "22:00", day_count: 5 })), "a client cannot start a second session on their own");
  expect(denied(await bob.db.from("session_grants").insert({ client_id: bob.id, granted_by: bob.id })), "a client cannot grant themselves another session");
  expect(denied(await bob.db.from("session_grants").insert({ client_id: bob.id, granted_by: coach.id })), "a client cannot forge a grant from a coach either");
  const grant = await coach.db.from("session_grants").insert({ client_id: bob.id, granted_by: coach.id }).select("id").single();
  expect(!grant.error, "a coach can reopen tracking for a client");
  expect(!(await bob.db.from("tracking_sessions").insert({ client_id: bob.id, label: "rls-check", wake_time: "06:00", sleep_time: "22:00", day_count: 5 })).error, "the client can start one more session after that");
  expect(denied(await bob.db.from("tracking_sessions").insert({ client_id: bob.id, label: "rls-check", wake_time: "06:00", sleep_time: "22:00", day_count: 5 })), "and no more than one");
  expect((await count(alice.db, "session_grants", "client_id", bob.id)) === 0, "a client cannot read another client's grants");
  // Buying a Peak Plan opens another Charge Index (Jen, 2026-09-29).
  await admin.from("purchases").insert({ client_id: bob.id, product: "basic_peak_plan", status: "completed" });
  expect(!(await bob.db.from("tracking_sessions").insert({ client_id: bob.id, label: "rls-check", wake_time: "06:00", sleep_time: "22:00", day_count: 5 })).error, "buying a Peak Plan opens one more session");
  expect(denied(await bob.db.from("tracking_sessions").insert({ client_id: bob.id, label: "rls-check", wake_time: "06:00", sleep_time: "22:00", day_count: 5 })), "but only one per purchase");
  expect(!(await coach.db.from("tracking_sessions").insert({ client_id: coach.id, label: "rls-check", wake_time: "06:00", sleep_time: "22:00", day_count: 5 })).error && !(await coach.db.from("tracking_sessions").insert({ client_id: coach.id, label: "rls-check", wake_time: "06:00", sleep_time: "22:00", day_count: 5 })).error, "coaches aren't limited — Jen tracks her own energy");

  console.log("\nUnlocking a Peak Plan by hand (2026-10-11)");
  // Checkout doesn't exist yet, so a coach opens the paid plan herself. The
  // whole point of the policy is that only a coach can, so most of these are
  // the refusals rather than the happy path.
  // Through the service role, so it doesn't disturb the session-allowance
  // arithmetic the block above just finished checking.
  const bobUnlockSession = (
    await admin
      .from("tracking_sessions")
      .insert({ client_id: bob.id, label: "rls-check unlock", wake_time: "06:00", sleep_time: "22:00", day_count: 5 })
      .select("id")
      .single()
  ).data.id;

  const unlocked = await coach.db
    .from("purchases")
    .insert({ client_id: bob.id, session_id: bobUnlockSession, product: "basic_peak_plan", status: "completed", granted_by: coach.id, note: "rls-check beta" })
    .select("id")
    .single();
  expect(!unlocked.error, "a coach can unlock a Peak Plan by hand");

  expect(
    denied(await bob.db.from("purchases").insert({ client_id: bob.id, session_id: bobUnlockSession, product: "basic_peak_plan", status: "completed", granted_by: bob.id })),
    "a client cannot unlock their own Peak Plan",
  );
  expect(
    denied(await bob.db.from("purchases").insert({ client_id: bob.id, session_id: bobUnlockSession, product: "basic_peak_plan", status: "completed", granted_by: coach.id })),
    "nor by stamping a coach's name on it",
  );
  expect(
    denied(await coach.db.from("purchases").insert({ client_id: bob.id, session_id: bobUnlockSession, product: "basic_peak_plan", status: "completed", granted_by: bob.id })),
    "a coach cannot credit the unlock to someone else",
  );
  // A hand-made row must never be able to pose as money that cleared Stripe.
  expect(
    denied(await coach.db.from("purchases").insert({ client_id: bob.id, session_id: bobUnlockSession, product: "basic_peak_plan", status: "completed", granted_by: coach.id, stripe_payment_intent_id: "pi_forged" })),
    "a coach cannot forge a Stripe payment reference",
  );
  // Nothing in the app edits a purchase, and the privilege is revoked, so a
  // client can't promote a pending row of their own to completed either.
  await admin.from("purchases").insert({ client_id: bob.id, product: "coaching", status: "pending" });
  await bob.db.from("purchases").update({ status: "completed" }).eq("client_id", bob.id).eq("product", "coaching");
  expect(
    (await admin.from("purchases").select("status").eq("client_id", bob.id).eq("product", "coaching").single()).data?.status === "pending",
    "a client cannot flip a pending purchase to completed",
  );

  // Taking it back is for a mis-click or the end of a beta...
  await coach.db.from("purchases").delete().eq("id", unlocked.data.id);
  expect(
    (await admin.from("purchases").select("id").eq("id", unlocked.data.id).maybeSingle()).data === null,
    "a coach can take back an unlock they made by hand",
  );
  // ...but never a row that wasn't made by hand. alice's purchase came from the
  // service role with no granted_by, which is the shape Stripe will write.
  const alicePurchase = (await admin.from("purchases").select("id").eq("client_id", alice.id).limit(1).single()).data;
  await coach.db.from("purchases").delete().eq("id", alicePurchase.id);
  expect(
    (await admin.from("purchases").select("id").eq("id", alicePurchase.id).maybeSingle()).data !== null,
    "a coach cannot delete a purchase that wasn't unlocked by hand",
  );
  await bob.db.from("purchases").delete().eq("client_id", bob.id);
  expect((await count(admin, "purchases", "client_id", bob.id)) > 0, "a client cannot delete their own purchases");

  console.log("\nReviewing a flag is Jen's alone");
  expect(
    Boolean((await alice.db.rpc("set_session_flag_review", { p_session: aliceSession, p_clear: true })).error),
    "a client cannot mark their own session reviewed",
  );
  expect(
    Boolean((await alice.db.from("tracking_sessions").update({ flag_cleared_at: new Date().toISOString() }).eq("id", aliceSession)).error) ||
      (await admin.from("tracking_sessions").select("flag_cleared_at").eq("id", aliceSession).single()).data?.flag_cleared_at === null,
    "nor write the column directly",
  );
  expect(!(await coach.db.rpc("set_session_flag_review", { p_session: aliceSession, p_clear: true })).error, "a coach can");
  expect(
    (await admin.from("tracking_sessions").select("flag_cleared_at").eq("id", aliceSession).single()).data?.flag_cleared_at !== null,
    "and it lands on the session",
  );
  expect(!(await coach.db.rpc("set_session_flag_review", { p_session: aliceSession, p_clear: false })).error, "and can put it back");
  // The stamp is what makes the flag return: an edited hour has to move its
  // updated_at, or re-filling the same grid would stay invisible.
  const { data: beforeEdit } = await admin
    .from("daily_entries")
    .select("updated_at")
    .eq("session_id", aliceSession)
    .limit(1)
    .single();
  await admin
    .from("daily_entries")
    .update({ energy_pct: 10 })
    .eq("session_id", aliceSession)
    .eq("day_number", 1)
    .eq("slot_hour", "09:00");
  const { data: afterEdit } = await admin
    .from("daily_entries")
    .select("updated_at")
    .eq("session_id", aliceSession)
    .eq("day_number", 1)
    .eq("slot_hour", "09:00")
    .single();
  expect(Boolean(afterEdit && beforeEdit && afterEdit.updated_at > beforeEdit.updated_at), "changing an entry moves its updated_at");
  expect(denied(await alice.db.from("daily_entries").update({ updated_at: "2020-01-01T00:00:00Z" }).eq("session_id", aliceSession)), "a client cannot backdate that stamp");
  expect(
    !(await alice.db.from("tracking_sessions").update({ status: "completed" }).eq("id", aliceSession)).error,
    "a client can still finish their own session",
  );

  console.log("\nPeak Plan notes — a paid feature, client-written only");
  // seedSession() already gave alice a completed basic_peak_plan purchase.
  expect(!(await alice.db.from("plan_notes").upsert({ session_id: aliceSession, slot_hour: "09:00", body: "Deep work" }, { onConflict: "session_id,slot_hour" })).error, "a client with the plan can write a note on their own hour");
  expect((await count(coach.db, "plan_notes", "session_id", aliceSession)) === 1, "the coach can read it");
  expect(denied(await coach.db.from("plan_notes").upsert({ session_id: aliceSession, slot_hour: "10:00", body: "coach wrote this" }, { onConflict: "session_id,slot_hour" })), "the coach cannot write in the client's plan");
  expect((await count(bob.db, "plan_notes", "session_id", aliceSession)) === 0, "another client cannot read it");
  expect(denied(await bob.db.from("plan_notes").insert({ session_id: aliceSession, slot_hour: "11:00", body: "forged" })), "another client cannot write in it");
  expect(!(await bob.db.from("plan_notes").delete().eq("session_id", aliceSession)).error && (await count(admin, "plan_notes", "session_id", aliceSession)) === 1, "and deleting it removes nothing");
  // Bob has sessions of his own but has never bought a plan.
  const { data: bobSession } = await bob.db.from("tracking_sessions").select("id").eq("client_id", bob.id).limit(1).single();
  expect(denied(await bob.db.from("plan_notes").insert({ session_id: bobSession.id, slot_hour: "09:00", body: "unpaid" })), "a client without the plan cannot write notes on their own session either");
  expect(!(await alice.db.from("plan_notes").delete().match({ session_id: aliceSession, slot_hour: "09:00" })).error, "the client can clear their own note");
  // Staff can open any plan, so on their OWN session that's enough to write
  // notes — Jen tracks her own energy and uses her own plan (2026-09-24).
  const { data: coachSession } = await coach.db.from("tracking_sessions").select("id").eq("client_id", coach.id).limit(1).single();
  expect(!(await coach.db.from("plan_notes").insert({ session_id: coachSession.id, slot_hour: "09:00", body: "my own plan" })).error, "a coach can write notes on their own plan, with no purchase");

  console.log("\nCorporate teams");
  const { data: company } = await coach.db.from("companies").insert({ name: "rls-check co", created_by: coach.id }).select("id").single();
  expect(Boolean(company), "a coach can create a company");
  expect(denied(await alice.db.from("companies").insert({ name: "forged", created_by: alice.id })), "a client cannot");
  expect((await count(alice.db, "companies", "id", company.id)) === 0, "and cannot read one");

  const { data: team } = await coach.db
    .from("teams")
    .insert({ company_id: company.id, name: "rls-check team" })
    .select("id")
    .single();
  const leadToken = `rls-lead-${stamp}`;
  const memberToken = `rls-member-${stamp}`;
  await coach.db.from("team_invites").insert([
    { team_id: team.id, kind: "lead", token: leadToken },
    { team_id: team.id, kind: "member", token: memberToken },
  ]);

  // Seats are the payment gate: nothing works until Jen opens them.
  expect(Boolean((await bob.db.rpc("join_team", { p_token: memberToken })).error), "the member link is closed until seats are set");
  expect(!(await alice.db.rpc("join_team", { p_token: leadToken })).error, "the lead link works once");
  expect(Boolean((await bob.db.rpc("join_team", { p_token: leadToken })).error), "and only once");

  await coach.db.from("teams").update({ seats: 2 }).eq("id", team.id);
  expect(!(await bob.db.rpc("join_team", { p_token: memberToken })).error, "a member joins once seats are open");
  const carol = await makeUser("carol");
  expect(Boolean((await carol.db.rpc("join_team", { p_token: memberToken })).error), "and the link refuses when the team is full");

  console.log("\nWhat a team lead can and cannot see");
  // alice is the lead, bob is a member with a session and entries.
  const { data: bobsSession } = await admin
    .from("tracking_sessions")
    .insert({ client_id: bob.id, label: "rls-check", wake_time: "06:00", sleep_time: "22:00", day_count: 5 })
    .select("id")
    .single();
  await admin.from("daily_entries").insert({ session_id: bobsSession.id, day_number: 1, slot_hour: "09:00", energy_pct: 100 });
  await admin.from("daily_notes").insert({ session_id: bobsSession.id, day_number: 1, for_jen_note: "private" });

  expect((await count(alice.db, "team_memberships", "team_id", team.id)) === 2, "the lead sees who is in their team");
  expect((await count(alice.db, "tracking_sessions", "client_id", bob.id)) === 0, "but not a member's sessions");
  expect((await count(alice.db, "daily_entries", "session_id", bobsSession.id)) === 0, "nor their entries");
  expect((await count(alice.db, "daily_notes", "session_id", bobsSession.id)) === 0, "nor their reflections");
  expect((await count(bob.db, "team_memberships", "team_id", team.id)) === 1, "a member sees only their own membership");
  expect((await count(alice.db, "team_invites", "team_id", team.id)) === 1, "the lead gets the member link, not the lead link");
  expect((await count(bob.db, "team_invites", "team_id", team.id)) === 0, "a member gets no links at all");
  // An update that matches no policy changes no rows rather than erroring, so
  // this reads the value back rather than trusting the response.
  await alice.db.from("teams").update({ seats: 99 }).eq("id", team.id);
  expect(
    (await admin.from("teams").select("seats").eq("id", team.id).single()).data?.seats === 2,
    "a lead cannot give themselves more seats",
  );
  expect(denied(await alice.db.from("team_rounds").insert({ team_id: team.id, number: 9 })), "nor start a round");

  console.log("\nThe lead's roster is aggregates only");
  const progressAsLead = await alice.db.rpc("team_progress", { p_team: team.id });
  expect(!progressAsLead.error && progressAsLead.data.length === 2, "a lead can read their team's progress");
  expect(
    progressAsLead.data.every((r) => "hours_logged" in r && "flagged" in r && !("energy_pct" in r)),
    "and gets counts, never an hour's value",
  );
  expect(Boolean((await bob.db.rpc("team_progress", { p_team: team.id })).error), "a member cannot read the roster");
  expect(Boolean((await carol.db.rpc("team_progress", { p_team: team.id })).error), "nor can someone outside the team");
  expect(!(await coach.db.rpc("team_progress", { p_team: team.id })).error, "a coach can");

  console.log("\nCompany notes and the corporate exports");
  await coach.db.from("companies").update({ notes: "coach-only" }).eq("id", company.id);
  expect(
    (await admin.from("companies").select("notes").eq("id", company.id).single()).data?.notes === "coach-only",
    "a coach can keep notes on a company",
  );
  await alice.db.from("companies").update({ notes: "forged" }).eq("id", company.id);
  expect(
    (await admin.from("companies").select("notes").eq("id", company.id).single()).data?.notes === "coach-only",
    "a team lead cannot change them",
  );

  console.log("\nThe team plan is released by hand");
  const { data: planRound } = await coach.db
    .from("team_rounds")
    .insert({ team_id: team.id, number: 9, status: "tracking" })
    .select("id")
    .single();
  expect(
    denied(await alice.db.from("team_plans").insert({ round_id: planRound.id, team_id: team.id, plan: {} })),
    "a lead cannot release their own team's plan",
  );
  await coach.db.from("team_plans").insert({ round_id: planRound.id, team_id: team.id, plan: { headlines: ["x"] } });
  expect((await count(alice.db, "team_plans", "team_id", team.id)) === 1, "a lead reads the plan once a coach releases it");
  expect((await count(bob.db, "team_plans", "team_id", team.id)) === 0, "a member never sees the team plan");
  expect((await count(carol.db, "team_plans", "team_id", team.id)) === 0, "nor does anyone outside the team");
  await coach.db.from("team_plans").delete().eq("round_id", planRound.id);
  expect((await count(alice.db, "team_plans", "team_id", team.id)) === 0, "and taking it back hides it again");
  await coach.db.from("team_rounds").delete().eq("id", planRound.id);

  console.log("\nTracking for a round");
  const { data: round } = await coach.db
    .from("team_rounds")
    .insert({ team_id: team.id, number: 1, status: "tracking" })
    .select("id")
    .single();
  const { data: bobRound } = await bob.db.rpc("active_round");
  expect(bobRound === round.id, "a member's active round is the one their team is running");
  expect((await bob.db.rpc("can_start_session")).data === true, "and it grants them a session even though they've used their own");
  expect(
    !(await bob.db.from("tracking_sessions").insert({ client_id: bob.id, label: "rls-check", wake_time: "06:00", sleep_time: "22:00", day_count: 5, round_id: round.id })).error,
    "so they can start tracking for it",
  );
  expect(
    (await bob.db.rpc("can_start_session")).data === false,
    "but only one session per round",
  );

} catch (error) {
  fail(`script error: ${error.message}`);
} finally {
  console.log("\nCleanup");
  for (const id of created) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) fail(`delete user ${id}: ${error.message}`);
  }
  // Companies survive their creator (created_by is ON DELETE SET NULL), so
  // they're removed by name — teams, invites, rounds and memberships cascade.
  await admin.from("companies").delete().eq("name", "rls-check co");
  const { count: leftover } = await admin
    .from("tracking_sessions")
    .select("*", { count: "exact", head: true })
    .eq("label", "rls-check");
  expect(leftover === 0, `deleted ${created.length} test users and their data`);
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}
