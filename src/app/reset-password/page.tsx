import { AuthShell } from "@/components/brand/AuthShell";
import { createClient } from "@/lib/supabase/server";

import { ResetForm } from "./reset-form";

/**
 * Where the reset link lands, by way of /auth/confirm.
 *
 * Deliberately NOT in the proxy's public list: arriving here needs the session
 * the link established, and that session is what proves the person owns the
 * mailbox. Someone who follows a stale link has no session, so the proxy sends
 * them to /login — which is the right answer, not a bug.
 *
 * It doubles as "change my password" for anyone already signed in, which is
 * why there's no check for how the session was obtained.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthShell
      eyebrow="Almost there"
      title={
        <>
          Choose a new
          <br />
          password
        </>
      }
      lead="One you'll remember. You're already signed in — this just replaces the password for next time."
    >
      <h2 className="mb-2 font-serif text-[28px] font-semibold text-navy">New password</h2>
      {user?.email ? <p className="mb-6 text-[13px] text-muted">For {user.email}</p> : null}
      <ResetForm />
    </AuthShell>
  );
}
