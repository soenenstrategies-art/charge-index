-- Unlocking a Peak Plan by hand — Jen, 2026-10-11.
--
-- Checkout doesn't exist yet (Phase 2 waits on Stripe), and until now a Peak
-- Plan could only be unlocked by someone running SQL with the service-role
-- key. That means Jen has to wait on a developer to deliver something she has
-- already sold, and it blocks a beta where testers need to see the paid half.
--
-- This gives coaches the same hand-operated control they already have for
-- reopening tracking (session_grants, 20260924143000): a row that records who
-- unlocked it and why, rather than a flag that forgets. It stays useful after
-- Stripe exists — comped plans, invoices, and the occasional refund.

-- Who unlocked it and why. Both stay null on anything Stripe writes later,
-- which is how a hand-made unlock is told apart from a real payment.
alter table public.purchases
  add column granted_by uuid references public.profiles (id),
  add column note text;

comment on column public.purchases.granted_by is
  'The coach who unlocked this by hand. Null on a Stripe payment.';
comment on column public.purchases.note is
  'Why it was unlocked by hand — "beta tester", "paid by e-transfer". Null on a Stripe payment.';

-- Coaches and admins may unlock; is_coach() covers both.
--
-- Three conditions, each load-bearing:
--   is_coach()                      — a client must never unlock their own plan.
--   granted_by = auth.uid()         — stamps who did it, rather than trusting
--                                     whatever the browser sent.
--   stripe_payment_intent_id null   — a hand-made row can never dress itself up
--                                     as a payment that actually cleared Stripe.
create policy "purchases_insert_coach"
  on public.purchases for insert
  with check (
    public.is_coach()
    and granted_by = auth.uid()
    and stripe_payment_intent_id is null
  );

-- Removing one is for a mis-click, or the end of a beta.
--
-- Only ever a row that was made by hand: deleting the record of money someone
-- actually paid is how a chargeback becomes unanswerable, so a Stripe row is
-- untouchable here even for a coach. Refunding one is Stripe's job, and will
-- set status = 'refunded' rather than deleting anything.
create policy "purchases_delete_coach_granted"
  on public.purchases for delete
  using (
    public.is_coach()
    and granted_by is not null
    and stripe_payment_intent_id is null
  );

-- Supabase grants anon and authenticated every privilege on every table, so
-- row-level security is the only thing standing in the way — the same shape as
-- the privilege escalation found on profiles in September (20260914203306).
-- Until today that didn't matter here, because purchases had no write policy
-- at all and RLS refused everything. The policies above change that: they are
-- now the only gate between a client and a free Peak Plan.
--
-- So take away what nothing uses:
--   anon          — nothing at all. A signed-out visitor has no purchases.
--   authenticated — select (a client reads their own, a coach reads all),
--                   insert and delete (the two policies above).
--
-- Deliberately NO update: nothing in the app edits a purchase, and without the
-- privilege a mistaken policy still couldn't flip somebody's pending row to
-- completed. service_role keeps everything — it's what Stripe's webhook will
-- use, and it bypasses RLS anyway.
revoke all on public.purchases from anon;
revoke all on public.purchases from authenticated;
grant select, insert, delete on public.purchases to authenticated;
