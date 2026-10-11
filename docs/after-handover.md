# Things to deal with after the handover

A running list. Nothing here is urgent and nothing here is broken — these are
items found during the handover that deserve attention once the ownership steps
in `HANDOFF.md` are finished. Add to it as things come up; tick them off as they
get done.

Product decisions (what a purchase includes, reminder wording, which plan to pay
for) are **not** here — those live in `HANDOFF.md` section 12.

---

## 0. Set up an email provider — **the beta blocker**

Promoted to the top on 2026-10-11, after it stopped work twice in one evening.

**Supabase's built-in sender allows about two emails an hour, across the whole
project** — not per person. Every signup confirmation and every password reset
comes out of the same two.

That evening it was hit in under fifteen minutes by entirely ordinary use: one
test signup at 20:49, one password reset at 21:02, and the third attempt was
refused. Trying a different address made no difference, which is how the
per-project limit was confirmed rather than assumed.

**Why this ends a beta before it starts.** Invite five people. Three sign up the
same evening — the third one's confirmation email is never sent. What they see
is a signup that silently doesn't arrive. They don't email to complain; they
assume it's broken and never come back.

**One setup fixes three things:**

1. **This limit** — thousands a month instead of two an hour.
2. **The same-browser confirmation problem.** Supabase refuses email-template
   changes while on its default sender, which is the only reason a new client
   must open their confirmation link in the browser they signed up in. Off the
   default sender, the template can be changed to the `token_hash` form and the
   link works anywhere.
3. **Reminders** — built, deployed and switched off since September for exactly
   this reason.

**Steps:** a Resend account under Jen's identity (free tier is far beyond what
this app would use) → verify a subdomain such as `mail.soenenstrategies.com`,
which means adding Resend's DNS records in **Wix's panel**, the same screen as
the `app` CNAME → create an API key → Supabase → Project Settings →
Authentication → SMTP Settings: host `smtp.resend.com`, port `465`, username
the literal word `resend`, password the API key, sender on the verified
subdomain. Then raise the per-hour limit under Authentication → Rate Limits,
and change the confirmation template.

**The API key never travels through a chat.** Resend → Supabase, nowhere else.

---

## 1. Turn on leaked-password protection — **blocked: needs a paid Supabase plan**

**Where:** Supabase → Authentication → Providers → Email, in the password
settings (not Attack Protection, where the bot check lives).

Supabase can check a new password against public lists of passwords exposed in
other companies' breaches, and refuse it. Worth having, because the people
signing up are coaching clients entering real personal data, and the commonest
way an account gets broken into is a password the person already reused from a
site that was breached.

**It is a Pro-plan feature.** This organisation is on `free` (checked
2026-10-07), so the toggle is visible but locked. Nothing to do here until the
plan question below is settled — then it really is one click.

**This is one of several things the free plan withholds**, and they're better
weighed together than one at a time:

- **Leaked-password protection** — this item.
- **The project pauses after about a week of no activity**, which breaks
  sign-ins while the site still loads normally. A scheduled job
  (`.github/workflows/supabase-keepalive.yml`) exists purely to work around
  this. On a paid plan the job becomes unnecessary.
- **Sign-up emails are rate-limited to a few an hour**, and the confirmation
  email's wording can't be changed while using Supabase's default sender —
  which is why a new client currently has to open their confirmation link in
  the same browser they signed up in.

**Recommendation: move to a paid plan before taking real money from clients.**
The pausing behaviour is the strongest argument — it fails silently, so the
first sign you'd get is a client saying they can't log in. Not urgent while the
app has no paying users; squarely a to-do before launch. Vercel's plan has a
similar question attached (see `HANDOFF.md` section 5 on Hobby being described
as non-commercial), so the two are worth deciding together.

---

## 2. Close off two internal functions from the public API

**What:** `handle_new_user` and `handle_user_email_change` can be called through
the project's API by anyone, signed in or not.

These two run automatically behind the scenes when someone signs up or changes
their email. They were never meant to be callable from outside. Calling one
directly would almost certainly just fail, because it expects to be handed a
new user record that an outside caller can't supply — so this is tidiness, not
an open door. But there's no reason to leave them reachable.

**Fix:** a small migration revoking API access to both. Needs the usual
"tell me what it does and wait for me to agree" step, and a run of
`./scripts/verify-local.sh` afterwards.

**Effort:** small. **Risk:** low, but it is a database change, so it gets tested
on the local copy first.

---

## 3. The other 12 flagged functions — reviewed, nothing to do

Recorded so nobody re-raises it. The same security scan flagged 12 more
functions as callable by signed-in users: `join_team`, `can_start_session`,
`team_progress`, `is_coach`, `is_team_lead`, `is_team_member`, `has_peak_plan`,
`active_round`, `entry_hour_open`, `entry_window_open`, `entry_window_closed`,
`set_session_flag_review`.

**That is how the app is supposed to work.** These are the deliberate helpers
that enforce the access rules — including the team-lead privacy boundary, which
*has* to be a function like this because checking a team's progress means
reading rows the lead isn't allowed to see directly. Each one checks who's
calling before it answers.

**Action: none.** Don't "fix" these.

---

## 4. One function missing a setting (same scan)

`touch_daily_entry` doesn't pin its `search_path`. It's a hardening detail
recommended by Supabase's linter rather than a live problem. Sensible to fold
into the same migration as item 2 rather than doing it on its own.

**Effort:** one line. **Risk:** low.

---

## 5. Patch the `sharp` image library

A high-severity advisory (`GHSA-wq5f-xc86-pv6w`, via librsvg) appeared on
2026-10-06 against the version pinned here. `npm audit fix` resolves it.

**It is not reachable in this app**, checked rather than assumed: the attack
needs the image optimiser to process a hostile image, and nothing invokes it —
no `next/image` anywhere, no `ImageResponse`, no remote image patterns, and the
app accepts no file uploads. `sharp` arrives as an optional sub-dependency of
Next.js and simply sits there.

So: patch on the next normal pass, not as an emergency.

---

## Done — kept for the record

- **Security headers** (added 2026-10-07). The app previously sent none, so it
  could be framed invisibly on someone else's page and a signed-in client
  tricked into clicking their own log. `next.config.ts` now sends
  `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options` and
  `Permissions-Policy` on every route, verified live. **A Content-Security-Policy
  is still not set** — it needs care around Next.js's inline bootstrap,
  Turnstile's iframe and Google Fonts, and a careless one breaks the app
  quietly. Worth doing as its own task.

---

## Where these came from

Items 1–4 are from Supabase's own security linter, run against the live project
on 2026-10-07 during the handover session. **Nothing was at error level, and
nothing was flagged for missing access rules** — the protection around client
data came back clean. Re-running that scan after any database change is a good
habit; ask Claude to check the security advisors.
