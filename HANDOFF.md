# Handing Charge Index™ over to Jen

This is the runbook for the day the app becomes fully yours. It's written to be followed in order — the order matters, because a few steps lock you out if done backwards.

Anything marked **(together)** is a step to do with Josh at your side. Everything else you can do alone, now or later.

Nothing in this file is secret, and it never should be: **this repository is public.**

---

## Where things stand

You already have an **admin account** (`soenenstrategies@gmail.com`), created on 2026-09-17. That means:

- You see every client at `/coach` — their sessions, daily logs, analysis, notes and exports.
- You see every **Peak Plan** without paying for it. Admin and coach accounts skip the purchase check entirely, which is why your account shows no purchases and still opens the full plan.
- You see the **Companies** side, which is the corporate product and is kept separate from your individual clients.

Nothing below needs to be done to keep the app running. It's all about moving the last pieces of control from Josh to you.

---

## 1. Reset the password on every account **(together)**

Josh created these under your email so they were yours from day one, but he knows the passwords. Change them all first, before anything else — every later step depends on you holding these.

| Account | What it is |
|---|---|
| **Supabase** | The database and all sign-ins. Project `charge-index`. |
| **Vercel** | Where the app runs. Team `soenen-strategies`. |
| **Cloudflare** | Only the bot check on signup and login (step 3). |
| **GitHub** | Where the code lives (step 5). |

Stripe and the email provider are different — you create those yourself, later (steps 7 and 8).

## 2. Put the app on your own address — **done 2026-10-07**

The app is live at **`https://app.soenenstrategies.com`**, with a valid HTTPS
certificate issued automatically by Vercel. `charge-index.vercel.app` still works
and still serves the same app, so no existing link is broken.

What was done, for the record:

1. **Vercel** → project → Domains → `app.soenenstrategies.com` added.
2. **Wix** → DNS records → a `CNAME` named `app` pointing at the value Vercel's
   Domains page gives. Vercel now shows a long project-specific target
   (`…vercel-dns-017.com`) and still accepts the older `cname.vercel-dns.com`;
   either works. **Read the current value off Vercel's Domains page rather than
   copying one from here** — Vercel changes it. Two things trip people up in
   Wix's panel: the host must be just `app` (Wix adds the rest itself), and the
   trailing dot Vercel displays has to be removed.
3. **Supabase** → Authentication → URL Configuration → Site URL set to
   `https://app.soenenstrategies.com`, and `https://app.soenenstrategies.com/**`
   added to Redirect URLs. The `charge-index.vercel.app` entry was deliberately
   kept, so anyone who signed up from the old address can still confirm.

Step 3 is the one people forget. Skip it and sign-up confirmation emails keep pointing at the old address, so new clients click a link that doesn't sign them in.

**A domain bought by mistake:** `appsoenenstrategies.com` (no dot) was registered
at Squarespace during this work and is being cancelled. It is not used by
anything. If a renewal notice for it ever appears, that's why — it should not be
renewed.

**Your website and the app are two different things.** Three separate pieces get
called "the domain", and keeping them apart makes everything else make sense:

- **The domain name** — `soenenstrategies.com`. You own it, registered through Wix.
- **DNS** — the directory saying which address points where. Also at Wix, because
  that's where your nameservers point.
- **Hosting** — what actually runs. Two different ones: `www` is your Wix website,
  `app` is this application on Vercel.

Adding `app.soenenstrategies.com` is one CNAME record in Wix's DNS panel. It's a
signpost, not a move — nothing is copied to Wix, and your website at `www` is
completely untouched.

**⚠️ If you ever move your website to Squarespace (or anywhere else):** this is
now a live risk, not a hypothetical one — the `app` record exists at Wix and the
app depends on it. Moving a site usually means moving the nameservers, and
**the `app` record will not come with them**. The app's custom address would quietly stop working — the app itself
keeps running, but `app.soenenstrategies.com` stops resolving. Recreate the same
CNAME at the new DNS host and it comes straight back. Worth telling whoever does
the migration, before they do it.

 Neither Wix nor Squarespace can host this app — website builders serve finished pages, and this one runs code: it signs people in and keeps them signed in, reads and writes a database with per-person access rules, generates calendar files and exports on demand, and runs a scheduled job. The arrangement that works: your site stays exactly where it is and links out to the app on your own subdomain. Visitors see one brand; underneath, the marketing site and the app stay separate, which is also what lets you redesign one without breaking the other.

## 3. Switch on the bot check — **done 2026-10-07**

Cloudflare Turnstile — the "confirm you're human" box — is **live on signup and
login**. It stops bots creating junk accounts, which would otherwise fill your
client list and burn through your sign-up email allowance.

What is where, so you can find it again:

1. **Cloudflare** (free account, your own identity) → Turnstile → one widget.
   Its **Hostnames** list holds `app.soenenstrategies.com` and
   `charge-index.vercel.app`. **Turnstile only runs on hostnames in that list** —
   if the app ever answers on a new address, add it here or the box fails there.
2. **Vercel** → Settings → Environment Variables →
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, set on **Production only**. The site key is
   public — it is visible in the page source by design.
3. **Supabase** → Authentication → Attack Protection → CAPTCHA enabled, provider
   **Turnstile**, secret key pasted there. **That is the only place the secret
   belongs.**

Verified on the day: the signup page served the widget container and the hidden
`captcha_token` field, the box rendered in a browser, and a real sign-in through
it succeeded.

**If you ever change these keys, the order matters.** Site key into Vercel →
redeploy → confirm the box appears → *then* the secret into Supabase. A secret
in Supabase with no working site key locks everyone out of signup **and** login,
including you. A site key with no secret shows the box but checks nothing.

**Your undo button:** turn CAPTCHA off in Supabase → Attack Protection. Sign-in
works again immediately.

**Two things that are normal and will look alarming:**

- **A new site key does nothing until you redeploy.** Values starting
  `NEXT_PUBLIC_` are baked into the pages when the app is built, so an existing
  deployment never picks one up.
- **You cannot sign in on a Vercel preview deployment any more.** Previews get
  one-off addresses that aren't in the Turnstile hostname list, and the site key
  isn't set for them, so they can't produce the token Supabase now demands. This
  doesn't affect the real site. If you ever need a preview login, add that
  preview's hostname to the Turnstile widget.

The box appears on **login as well as signup**, on purpose: once Supabase has a CAPTCHA enabled it requires one on every sign-in, so it has to be on both.

## 4. Replace every key created during the build **(together)**

Keys made while Josh held your accounts should all be replaced. For each one: create the new key, update it where it's used, redeploy, confirm the site still works, *then* delete the old one. In that order — deleting first takes the site down.

| Key | Create it at | Used by |
|---|---|---|
| Supabase publishable (anon) key | Supabase → Project Settings → API | Vercel env `NEXT_PUBLIC_SUPABASE_ANON_KEY`, GitHub secret `SUPABASE_ANON_KEY` |
| Supabase service role (secret) key | Supabase → Project Settings → API | Vercel env `SUPABASE_SERVICE_ROLE_KEY` |
| Supabase access token | Supabase → Account → Access Tokens | Josh's tooling — **revoke his, create your own** |
| Vercel token | Vercel → Account Settings → Tokens | Josh's tooling — **revoke his** |
| Cron secret | Any long random string | Vercel env `CRON_SECRET` and GitHub secret `CRON_SECRET` |

The service role key deserves a note: it bypasses every access rule in the database. It belongs in Vercel and on your own machine, and nowhere else — not in an email, not in a chat, not in this repository.

## 5. Take ownership of the code **(together)**

**This step is done.** Recorded here so you know what was done and how it was checked.

1. ~~Transfer the GitHub repository to your own GitHub account.~~ **Done.** It now lives at `soenenstrategies-art/charge-index`, under your account, with the whole build history.
2. ~~Check the repository's **Actions secrets** survived the move.~~ **Done for the two that are in use** — the keep-alive job ran on schedule under your ownership on 2026-10-04 and succeeded, which only works if `SUPABASE_URL` and `SUPABASE_ANON_KEY` are both there. `CRON_SECRET` still has to be added when reminders are switched on (step 8).
3. ~~In **Vercel**, connect the project to the repository using **your** GitHub login.~~ **Done 2026-10-07.** Pushing to `main` now deploys on its own.

**What that means day to day:** you ask Claude for a change, it pushes to `main`, and Vercel deploys it. There is no token to keep and no deploy command to run. If a deploy ever needs checking, the Vercel dashboard is the place — Claude Code in a cloud session cannot reach Vercel or Supabase over the network, so it can confirm the push but not the deploy.

**About the repository being public.** Vercel's free Hobby plan only deploys commits authored by the account owner — unless the repository is public. That's why it was made public during the build. Once you own it and are the only one committing, you can make it private again. If someone else will keep working on it, it either stays public or you move to Vercel Pro. Vercel's own terms also describe Hobby as non-commercial use, which is worth settling before you charge real money.

## 6. Set up your own Claude Code **(together)**

This is what lets you keep changing the app without a developer.

Full step-by-step for a fresh laptop, including what to install and in what
order, is in **`docs/new-machine-setup.md`**. In short:

1. Install Node, Git, Docker Desktop, and Claude Code — signed in as you.
2. `git clone` the repository, then `npm install`.
3. Copy the two template files into place:
   ```bash
   cp docs/env.local.template .env.local
   cp docs/claude-settings.local.template.json .claude/settings.local.json
   ```
   Then fill in the values each file describes. Both are gitignored and must never be committed.
4. Run `./scripts/verify-local.sh` once. 153 checks against a throwaway copy of the database — if it ends with "All checks passed", the machine is set up correctly.
5. Paste the starting prompt from **`docs/first-session-prompt.md`** as your first message.

Claude reads `CLAUDE.md` automatically every time you open this folder, so every session starts knowing how the app is built and why. `docs/first-session-prompt.md` is only needed once.

## 7. Take payments **(together)**

1. Create your **Stripe** account and start in **Test Mode** — no business verification needed to build against it.
2. **(together)** Build the checkout against Test Mode (Build Plan Phase 2).
3. Complete Stripe's business and banking verification to reach **Live Mode**.
4. **(together)** Add the live keys and webhook signing secret to Vercel, then do one supervised real purchase.

**You can already sell one without Stripe.** On a client's page there's a
**Peak Plan access** card: type a reason ("beta tester", "paid by e-transfer")
and click Unlock. The client sees their plan next time they open their results
— they get no email, so tell them. "Lock again" takes it back. It also gives
them another Charge Index, which is the same thing a real purchase does.

Until Stripe is done, the self-serve "Unlock my plan" button stays disabled and
no client can buy a Peak Plan by themselves. Corporate seats are already independent of Stripe — you open those by hand (step 9), which is how a company can pay you by invoice today.

## 7b. Switch on your booking links

The "Book a call" and "Book the session" buttons across the site pointed at two
Calendly links that were dead by 2026-10-07 — Calendly answered them with "This
Calendly URL is not valid", which reads as a broken business rather than an
unfinished one. There were eight of them, including the one on the results
screen, where a client has just finished tracking and is as interested as
they'll ever be.

They no longer point anywhere until you say so. Right now, clicking one opens a
short message saying booking isn't open yet and offering your email address, so
nobody hits a dead end.

To switch them on, in **Vercel → Settings → Environment Variables** (Production):

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_BOOKING_URL_CALL` | The free intro call — used in the header, footer, landing page and setup screen |
| `NEXT_PUBLIC_BOOKING_URL_SESSION` | The paid Peak Plan session — used on the pricing card and the client's results screen |

Paste your real links, redeploy, and those buttons become ordinary links that
open in a new tab. Set one and not the other and that's fine — the other keeps
explaining itself.

**Check them once a year.** These broke silently, and nothing in the app can
tell that a booking link has stopped working.

## 8. Switch on reminders (optional, later)

Reminders are built and deployed but dormant. They need an email provider account (Resend or Postmark), the sender wired in, and the steps at the top of `.github/workflows/reminders.yml`.

The same provider fixes a second thing. Supabase's built-in email sender manages only 2–3 messages an hour and its wording can't be changed on the free plan, which is why a new client currently has to open their confirmation link **in the same browser they signed up in**. Once a provider exists: point Supabase's SMTP settings at it, then **(together)** change the confirmation email's link to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email` so it works on any device.

## 9. How the corporate side works

This is the part that didn't exist when the first handover notes were written. It lives under **Companies** in your coach navigation, deliberately separate from your individual clients.

**The shape:** a **company** has one or more **teams**. A team has a **lead** and its members. A team runs **rounds** — one stretch of tracking each. A round produces one **team Peak Plan**.

**Setting one up:**

1. Add the company, then add a team inside it.
2. The team gets two links. Send the **lead link** first — it's single use, and whoever opens it becomes the team lead.
3. **Seats stay at zero until you set them.** That's the payment gate: the member link refuses everyone while seats are 0. Once the company has paid you, set the number of seats and the lead distributes the member link themselves. The lead counts as a seat.
4. Start a round when the team is ready to track.
5. When the round has enough data, you press **Release to the lead**. Nothing is automatic — the plan reaches the lead only when you decide it does.

**The privacy line, which is the whole point of the design:**

- A **team lead** sees each member's *progress* — how many hours they've logged, and whether they've been flagged — and the released team plan. The lead **never** sees any individual's energy levels, their curve, their notes, or their own Peak Plan.
- A **member** sees only their own data, exactly like any individual client.
- **You** see everything.

A member is **flagged** to the lead when they log the same level for five hours straight on two days — the signal that something's wrong, and deliberately the only judgement the lead ever sees.

The released plan is **stored** at the moment you release it, not recalculated on the fly. So a plan a company has been given can't quietly shift underneath them if someone logs more hours afterwards. "Rebuild from the latest data" replaces it on purpose; "Take it back" removes the lead's access immediately.

## 10. Clear out the build's test data — **mostly done 2026-10-07**

These exist only because of the build and shouldn't be in your records. Josh's account goes **last**, because several steps above need an admin who isn't you in case something goes wrong.

| What | Why it's there | State |
|---|---|---|
| `qa-...@example.com` (Quinn Tester) | A QA account, with **two Peak Plan purchases that were never paid for** | ✅ **deleted 2026-10-07** |
| `demo-lead@`, `demo-member1@`, `demo-member2@example.com` | The seeded corporate team Josh used to walk you through the flow | ✅ **deleted 2026-10-07** |
| Company **"Test Company 1"** and its teams | The same walkthrough | ⬜ still there — two teams, two rounds, now with no members |
| `sacchettijosh@gmail.com` (Joshua Sacchetti) | Josh's build account — admin access, 2 sessions and **1 unpaid Peak Plan purchase** | ⬜ **kept on purpose, until last** |

After the 2026-10-07 clear-out the database holds **two accounts — yours and Josh's** — 8 sessions and no orphaned rows.

**Deleting an account is one step.** Remove the user and everything of theirs
follows: their profile, sessions, logged hours, notes, purchases and team
memberships all cascade. Verified afterwards that nothing was left stranded.
Two cases would refuse to delete: a coach who has granted someone an extra
Charge Index, and a team round that still has sessions attached. Neither
applies today.

If you ever see a client you don't recognise — anything named "ZZ TEST", or an `@example.com` address — tell your developer. It shouldn't happen: the verification scripts refuse to run against your live database (see below), which is exactly why that rule exists.

## 11. Check everything still works **(together)**

1. Sign up as a brand-new test client, set up a session, log a few hours.
2. As admin, open that client from `/coach` and look at their session.
3. Open a Peak Plan, and download the calendar file and a CSV.
4. Open **Companies** and confirm a team's progress view shows hours only, never levels.
5. **(together)** Run both automated checks:
   ```bash
   ./scripts/verify-local.sh
   ```
   That's 153 checks covering who can open which screen and read which data. It runs against a throwaway copy of the database on the developer's machine, **never your live project** — so no test accounts ever appear in your client list.
6. Delete the test client from step 1.

## 12. Decisions still waiting for you

**Technical odds and ends found during the handover are kept separately, in
`docs/after-handover.md`** — none of them urgent, none of them broken. This
section is for the business decisions only.

These are in the build notes rather than here, because they're product questions, not handover steps: what a Peak Plan purchase includes, the reminder times and wording, and whether to move off the free Vercel and Supabase plans before you start charging.

One is worth flagging now: **Supabase's free plan pauses a database after about a week of no activity**, which silently breaks sign-ins while the site still appears to load. A small scheduled job (`.github/workflows/supabase-keepalive.yml`) keeps it awake. Leave it in place unless you upgrade.
