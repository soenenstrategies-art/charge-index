import { redirect } from "next/navigation";

import { AuthShell } from "@/components/brand/AuthShell";
import { createClient } from "@/lib/supabase/server";

import { ForgotForm } from "./forgot-form";

/** Public, like /login and /signup — someone locked out has no session to show. */
export default async function ForgotPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Already signed in? Then nothing is locked, and /reset-password is the
  // place to change a password you still know.
  if (user) redirect("/reset-password");

  return (
    <AuthShell
      eyebrow="Locked out"
      title={
        <>
          Let&rsquo;s get you
          <br />
          back in
        </>
      }
      lead="Your log is safe. A password is the only thing between you and it, and that part is easy to replace."
    >
      <h2 className="mb-6 font-serif text-[28px] font-semibold text-navy">Forgot your password</h2>
      <ForgotForm />
    </AuthShell>
  );
}
