import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CoachShell } from "@/components/CoachShell";
import { NoteForm } from "@/components/coach/NoteForm";
import { loadSessionBundles } from "@/lib/coach-data";
import { formatHour } from "@/lib/slots";
import { requireCoach } from "@/lib/viewer";
import { MIN_HOURS_FOR_RESULT, formatRanges } from "@/lib/weekly-map";

import { deleteNote, grantSession, relockPeakPlan, reviewFlag, revokeSession, unlockPeakPlan } from "./actions";

/** One client: every session with its headline numbers, Jen's notes, and exports. */
export default async function CoachClientPage({ params }: PageProps<"/coach/clients/[clientId]">) {
  const { clientId } = await params;
  const { supabase, user } = await requireCoach(`/coach/clients/${clientId}`);

  const [{ data: client }, bundles, { data: notes }, { data: grants }, { data: unlocks }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, created_at, role").eq("id", clientId).maybeSingle(),
    loadSessionBundles(supabase, clientId),
    supabase
      .from("coach_notes")
      .select("id, body, created_at, session_id, author_id, author:profiles!coach_notes_author_id_fkey(full_name)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("session_grants")
      .select("id, created_at, granted_by, granter:profiles!session_grants_granted_by_fkey(full_name)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    // Peak Plan access. Hand-made unlocks carry granted_by; a Stripe payment
    // won't, which is how the card below tells them apart.
    supabase
      .from("purchases")
      .select("id, session_id, status, note, purchased_at, granted_by, granter:profiles!purchases_granted_by_fkey(full_name)")
      .eq("client_id", clientId)
      .eq("product", "basic_peak_plan")
      .eq("status", "completed"),
  ]);

  // Clients always; coaches and admins only if they've tracked a session.
  if (!client || (client.role !== "client" && bundles.length === 0)) notFound();

  const name = client.full_name?.trim() || "Unnamed client";

  // How the client fills the grid, across everything they've logged.
  const flaggedSessions = bundles.filter((b) => b.flatRun);
  // Reviewed ones stay visible as "reviewed" rather than vanishing, so Jen can
  // see she's already dealt with them — and undo it.
  const reviewedSessions = bundles.filter((b) => !b.flatRun && b.session.flag_cleared_at);

  // One session each, plus one per grant Jen has given (2026-09-24).
  const grantCount = grants?.length ?? 0;
  const allowance = 1 + grantCount;
  const unusedGrants = Math.max(0, allowance - bundles.length);
  const sessionLabel = new Map(bundles.map((b) => [b.session.id, b.session.label || "Untitled session"]));
  // A purchase with a null session_id unlocks nothing (both plan gates match on
  // session_id), so only the ones tied to a session count here.
  const unlockBySession = new Map((unlocks ?? []).filter((u) => u.session_id).map((u) => [u.session_id as string, u]));
  const when = (iso: string) => new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });

  return (
    <CoachShell>
      <Link href="/coach" className="text-[12px] font-bold text-muted underline">
        ← Clients
      </Link>

      <div className="aurora animate-rise mt-3 mb-5 flex flex-wrap items-end justify-between gap-5 rounded-[28px] px-6 py-8 text-white shadow-[0_30px_70px_-35px_rgba(19,36,73,0.8)] sm:px-9">
        <div className="min-w-0 wrap-anywhere">
          <div className="mb-[7px] text-[10px] font-extrabold tracking-[0.15em] text-white/50 uppercase">
            Coach view · not visible to client
          </div>
          <h1 className="font-serif text-[30px] leading-[1.15] font-semibold">
            {name}
            {client.role !== "client" ? (
              <span className="ml-3 rounded-full bg-gold px-[9px] py-[3px] align-middle font-sans text-[11px] font-extrabold tracking-[0.06em] text-white uppercase">
                {client.role}
              </span>
            ) : null}
          </h1>
          <p className="mt-[7px] text-[13.5px] text-white/75">
            {client.email ?? "No email"} · joined {client.created_at.slice(0, 10)} · {bundles.length}{" "}
            {bundles.length === 1 ? "session" : "sessions"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/coach/clients/${clientId}/summary.csv`}
            className="inline-flex min-h-11 items-center rounded-2xl border-[1.5px] border-white/30 bg-white/10 px-5 text-[13.5px] font-extrabold text-white transition hover:bg-white/20"
          >
            Summary (CSV)
          </a>
          {bundles.length ? (
            <a
              href={`/coach/clients/${clientId}/sessions.zip`}
              className="inline-flex min-h-11 items-center rounded-2xl bg-gold px-5 text-[13.5px] font-extrabold text-navy-deep transition hover:-translate-y-0.5 hover:bg-gold-bright"
            >
              All session data (ZIP)
            </a>
          ) : null}
        </div>
      </div>

      {flaggedSessions.length ? (
        <Card className="mb-5" accent={10}>
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-level-10/12 text-[20px] text-level-10" aria-hidden>
              ⚑
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-[20px] font-semibold text-navy">Same level, hours at a time</h2>
              <p className="mt-1 text-[13.5px] leading-[1.6] text-body">
                Five or more straight hours on a single level, two days running, in{" "}
                {flaggedSessions.map((b) => b.session.label || "an untitled session").join(", ")}. Worth a call: it
                usually means the grid is being filled in rather than read, and a plan built from it would inherit that.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {flaggedSessions.map((b) => (
                  <form key={b.session.id} action={reviewFlag.bind(null, clientId, b.session.id, true)}>
                    <button
                      type="submit"
                      className="inline-flex min-h-10 items-center rounded-xl border-[1.5px] border-level-10/40 bg-white px-4 text-[12.5px] font-extrabold text-level-10 transition hover:bg-level-10/10"
                    >
                      Mark {b.session.label || "this session"} reviewed
                    </button>
                  </form>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {reviewedSessions.length ? (
        <Card className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[12.5px] text-body">
              <strong className="text-navy">Reviewed:</strong>{" "}
              {reviewedSessions.map((b) => b.session.label || "an untitled session").join(", ")}. The flag returns by
              itself if they log the same way again.
            </p>
            <div className="flex flex-wrap gap-2">
              {reviewedSessions.map((b) => (
                <form key={b.session.id} action={reviewFlag.bind(null, clientId, b.session.id, false)}>
                  <button type="submit" className="inline-flex min-h-9 items-center px-2 text-[12px] font-bold text-muted underline hover:text-navy">
                    Show the flag again
                  </button>
                </form>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="mb-5" accent="gold">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-serif text-[20px] font-semibold text-navy">Tracking access</h2>
            <p className="mt-1 text-[13.5px] leading-[1.6] text-body">
              One Charge Index each. This client has used {bundles.length} of {allowance}
              {allowance === 1 ? " session" : " sessions"}.{" "}
              {unusedGrants > 0
                ? `They can start ${unusedGrants} more now.`
                : "They can't start another until you reopen it."}
            </p>
          </div>
          <form action={grantSession.bind(null, clientId)}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-2xl bg-navy px-5 text-[13.5px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-navy-light"
            >
              Reopen tracking
            </button>
          </form>
        </div>
        {grantCount ? (
          <ul className="m-0 mt-4 flex list-none flex-col gap-2 border-t border-[#f0efea] p-0 pt-4">
            {grants!.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-body">
                <span>
                  Reopened by <strong className="text-navy">{g.granter?.full_name || "a coach"}</strong> · {when(g.created_at)}
                </span>
                <form action={revokeSession.bind(null, clientId, g.id)}>
                  <button type="submit" className="-mx-2 -my-2 inline-flex min-h-9 items-center px-2 font-bold text-muted underline hover:text-level-10">
                    Undo
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="mb-5 p-0" accent="spectrum">
        <h2 className="px-6 pt-6 pb-3 font-serif text-[22px] font-semibold text-navy">Sessions</h2>
        {bundles.length === 0 ? (
          <p className="px-6 pb-6 text-[13.5px] text-body">No sessions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-y border-line text-[10px] font-extrabold tracking-[0.08em] text-muted uppercase">
                  <th className="px-6 py-3">Session</th>
                  <th className="px-3 py-3">Waking</th>
                  <th className="px-3 py-3">Covered</th>
                  <th className="px-3 py-3">Peak</th>
                  <th className="px-3 py-3">Collaboration</th>
                  <th className="px-3 py-3">Recovery</th>
                  <th className="px-6 py-3">Open</th>
                </tr>
              </thead>
              <tbody>
                {bundles.map((b) => (
                  <tr key={b.session.id} className="border-b border-[#f0efea] last:border-b-0">
                    <td className="px-6 py-3">
                      <Link href={`/coach/sessions/${b.session.id}`} className="font-extrabold text-navy underline">
                        {b.session.label || "Untitled session"}
                      </Link>
                      {b.flatRun ? (
                        <span
                          className="ml-2 rounded-full bg-level-10/12 px-[7px] py-[2px] text-[10px] font-extrabold tracking-[0.05em] text-level-10 uppercase"
                          title="Five or more straight hours on one level, two days running"
                        >
                          ⚑ same level
                        </span>
                      ) : null}
                      <div className="text-[11px] text-muted">
                        {b.session.start_date} · {b.session.status === "completed" ? "Complete" : "In progress"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-body">
                      {formatHour(b.wake)} – {formatHour(b.sleep)}
                    </td>
                    <td className="px-3 py-3 text-body">
                      {b.consistency.coveragePct}%
                      <div className="text-[11px] text-muted">
                        {b.consistency.completeDays}/{b.session.day_count} days full
                      </div>
                      {b.entries.length < MIN_HOURS_FOR_RESULT ? (
                        <div className="text-[11px] font-bold text-level-25">
                          {b.entries.length}/{MIN_HOURS_FOR_RESULT} hrs — no client result
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-body">{formatRanges(b.windows.peak)}</td>
                    <td className="px-3 py-3 text-body">{formatRanges(b.windows.collaboration)}</td>
                    <td className="px-3 py-3 text-body">{formatRanges(b.windows.recovery)}</td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <Link href={`/plan/${b.session.id}`} className="font-bold text-navy underline">
                        Plan
                      </Link>
                      <span className="text-muted"> · </span>
                      <a href={`/coach/sessions/${b.session.id}/export.csv`} className="font-bold text-navy underline">
                        CSV
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mb-5">
        <h2 className="mb-1 font-serif text-[22px] font-semibold text-navy">Peak Plan access</h2>
        <p className="mb-4 text-[12px] text-muted">
          Checkout isn&rsquo;t built yet, so you open the paid plan by hand &mdash; for a beta tester, or someone who
          paid you another way. Unlocking also gives them another Charge Index. They aren&rsquo;t emailed; their results
          screen just shows the plan next time they look.
        </p>

        {bundles.length === 0 ? (
          <p className="text-[13.5px] text-body">No sessions yet, so there&rsquo;s nothing to unlock.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {bundles.map((b) => {
              const unlock = unlockBySession.get(b.session.id);
              const thin = b.entries.length < MIN_HOURS_FOR_RESULT;
              return (
                <li key={b.session.id} className="rounded-2xl border-[1.5px] border-line px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 wrap-anywhere">
                      <div className="text-[13.5px] font-extrabold text-navy">
                        {b.session.label || "Untitled session"}
                      </div>
                      <div className="text-[11px] text-muted">
                        {b.session.start_date} ·{" "}
                        {unlock ? (
                          <span className="font-bold text-level-100">Peak Plan unlocked</span>
                        ) : (
                          <span className="font-bold text-muted">Locked</span>
                        )}
                        {thin ? (
                          <>
                            {" · "}
                            <span className="font-bold text-level-25">
                              only {b.entries.length}/{MIN_HOURS_FOR_RESULT} hrs — the plan will come out empty
                            </span>
                          </>
                        ) : null}
                      </div>
                      {unlock ? (
                        <div className="mt-[5px] text-[11.5px] text-body">
                          By {unlock.granter?.full_name?.trim() || "a coach"} on {when(unlock.purchased_at)}
                          {unlock.note ? <> · &ldquo;{unlock.note}&rdquo;</> : null}
                        </div>
                      ) : null}
                    </div>

                    {unlock ? (
                      <form action={relockPeakPlan.bind(null, clientId, unlock.id)}>
                        <button
                          type="submit"
                          className="inline-flex min-h-9 items-center rounded-xl border-[1.5px] border-line px-3 text-[12px] font-extrabold text-muted transition hover:border-level-10 hover:text-level-10"
                        >
                          Lock again
                        </button>
                      </form>
                    ) : (
                      <form
                        action={unlockPeakPlan.bind(null, clientId, b.session.id)}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <label htmlFor={`unlock-note-${b.session.id}`} className="sr-only">
                          Why you&rsquo;re unlocking this Peak Plan
                        </label>
                        <input
                          id={`unlock-note-${b.session.id}`}
                          name="note"
                          type="text"
                          maxLength={200}
                          placeholder="Beta tester, paid by e-transfer…"
                          className="min-h-9 w-[220px] rounded-xl border-[1.5px] border-line bg-white px-3 text-[12.5px] text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/20"
                        />
                        <button
                          type="submit"
                          className="inline-flex min-h-9 items-center rounded-xl bg-navy px-4 text-[12px] font-extrabold text-white transition hover:-translate-y-0.5"
                        >
                          Unlock Peak Plan
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card accent="gold">
        <h2 className="mb-1 font-serif text-[22px] font-semibold text-navy">Coach notes</h2>
        <p className="mb-4 text-[12px] text-muted">Private to coaches. Clients never see these.</p>
        <NoteForm clientId={clientId} sessions={bundles.map((b) => ({ id: b.session.id, label: b.session.label || "Untitled session" }))} />

        {notes?.length ? (
          <ol className="m-0 mt-6 flex list-none flex-col gap-4 p-0">
            {notes.map((n) => (
              <li key={n.id} className="border-t border-[#f0efea] pt-4">
                <div className="mb-[6px] flex flex-wrap items-baseline justify-between gap-2 text-[11.5px] text-muted">
                  <span className="min-w-0 wrap-anywhere">
                    <strong className="text-navy">{n.author?.full_name || "A coach"}</strong> · {when(n.created_at)}
                    {n.session_id ? ` · about ${sessionLabel.get(n.session_id) ?? "a session"}` : ""}
                  </span>
                  {n.author_id === user.id ? (
                    <form action={deleteNote.bind(null, clientId, n.id)}>
                      <button
                        type="submit"
                        className="-mx-2 -my-2 inline-flex min-h-9 items-center px-2 font-bold text-muted underline hover:text-level-10"
                      >
                        Delete
                      </button>
                    </form>
                  ) : null}
                </div>
                <p className="m-0 text-[13.5px] leading-[1.65] whitespace-pre-wrap text-body">{n.body}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </Card>
    </CoachShell>
  );
}
