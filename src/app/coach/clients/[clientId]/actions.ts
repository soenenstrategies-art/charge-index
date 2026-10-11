"use server";

import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/viewer";

export type NoteState = { error: string } | { saved: number } | null;

const MAX_NOTE = 5000;

/** Add a private coach note about a client, optionally tied to one of their sessions. */
export async function addNote(clientId: string, _prev: NoteState, formData: FormData): Promise<NoteState> {
  const { supabase, user } = await requireCoach(`/coach/clients/${clientId}`);

  const body = String(formData.get("body") ?? "").trim();
  const sessionId = String(formData.get("session_id") ?? "") || null;
  if (!body) return { error: "Write something first." };
  if (body.length > MAX_NOTE) return { error: `Notes are limited to ${MAX_NOTE.toLocaleString()} characters.` };

  if (sessionId) {
    // The session must belong to this client, or the note would be misfiled.
    const { data: owned } = await supabase
      .from("tracking_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!owned) return { error: "That session doesn't belong to this client." };
  }

  const { error } = await supabase
    .from("coach_notes")
    .insert({ client_id: clientId, session_id: sessionId, author_id: user.id, body });
  if (error) return { error: `The note couldn't be saved: ${error.message}` };

  revalidatePath(`/coach/clients/${clientId}`);
  return { saved: Date.now() };
}

/** Delete a note. RLS only lets its author delete it; anyone else deletes nothing. */
export async function deleteNote(clientId: string, noteId: string) {
  const { supabase } = await requireCoach(`/coach/clients/${clientId}`);
  await supabase.from("coach_notes").delete().eq("id", noteId).eq("client_id", clientId);
  revalidatePath(`/coach/clients/${clientId}`);
}

/**
 * Reopen tracking for a client — Jen's rule: one Charge Index each, and she
 * decides when someone measures again (2026-09-24). Each grant is one extra
 * session and stays on the record, so "who reopened this, and when" survives.
 */
export async function grantSession(clientId: string) {
  const { supabase, user } = await requireCoach(`/coach/clients/${clientId}`);
  await supabase.from("session_grants").insert({ client_id: clientId, granted_by: user.id });
  revalidatePath(`/coach/clients/${clientId}`);
}

/** Take back a grant the client hasn't used yet. */
export async function revokeSession(clientId: string, grantId: string) {
  const { supabase } = await requireCoach(`/coach/clients/${clientId}`);
  await supabase.from("session_grants").delete().eq("id", grantId).eq("client_id", clientId);
  revalidatePath(`/coach/clients/${clientId}`);
}

/**
 * Mark a flagged session as reviewed, or bring the flag back (Josh,
 * 2026-09-29). Clearing stamps the time; anything the client logs after that
 * raises the flag again by itself.
 */
export async function reviewFlag(clientId: string, sessionId: string, clear: boolean) {
  const { supabase } = await requireCoach(`/coach/clients/${clientId}`);
  await supabase.rpc("set_session_flag_review", { p_session: sessionId, p_clear: clear });
  revalidatePath(`/coach/clients/${clientId}`);
  revalidatePath("/coach");
}

const MAX_UNLOCK_NOTE = 200;

/**
 * Unlock a session's Peak Plan by hand — Jen, 2026-10-11.
 *
 * Checkout doesn't exist yet, so this is how the paid half reaches someone who
 * settled by invoice, or a beta tester seeing it for free. The row carries no
 * Stripe reference and records who unlocked it and why, so a hand-made unlock
 * can always be told from a payment that actually cleared.
 *
 * Worth knowing: a completed basic_peak_plan purchase also buys the client
 * another Charge Index (can_start_session), so unlocking reopens tracking for
 * them too. That's inherited from the paid flow and left deliberately alone.
 */
export async function unlockPeakPlan(clientId: string, sessionId: string, formData: FormData) {
  const { supabase, user } = await requireCoach(`/coach/clients/${clientId}`);

  // The session must belong to this client, or the unlock lands on someone
  // else's plan. RLS wouldn't catch this: a coach may write either row.
  const { data: owned } = await supabase
    .from("tracking_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!owned) return;

  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, MAX_UNLOCK_NOTE);

  await supabase.from("purchases").insert({
    client_id: clientId,
    session_id: sessionId,
    product: "basic_peak_plan",
    status: "completed",
    granted_by: user.id,
    note: note || null,
  });

  revalidatePath(`/coach/clients/${clientId}`);
}

/**
 * Take an unlock back — a mis-click, or a beta that's over.
 *
 * RLS only allows this for a row made by hand: a Stripe payment stays put even
 * for a coach, because deleting the record of money someone paid is how a
 * dispute becomes unanswerable. Refunds set status instead.
 */
export async function relockPeakPlan(clientId: string, purchaseId: string) {
  const { supabase } = await requireCoach(`/coach/clients/${clientId}`);
  await supabase.from("purchases").delete().eq("id", purchaseId).eq("client_id", clientId);
  revalidatePath(`/coach/clients/${clientId}`);
}
