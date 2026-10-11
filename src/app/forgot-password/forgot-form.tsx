"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestPasswordReset } from "@/app/auth/actions";
import { Turnstile } from "@/components/auth/Turnstile";
import { FieldLabel, FormError, SubmitButton, inputClass } from "@/components/AppShell";

function Submit() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Email me a reset link</SubmitButton>;
}

export function ForgotForm() {
  const [state, formAction] = useActionState(requestPasswordReset, null);

  // Deliberately the same wording whoever the address belongs to: this screen
  // must never become a way to find out who has an account here.
  if (state && "sent" in state) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[15px] leading-[1.7] text-body">
          If <strong className="text-navy">{state.sent}</strong> has an account, a link to choose a new password is on
          its way. It lasts an hour.
        </p>
        <p className="rounded-2xl bg-cream px-4 py-3 text-[13px] leading-[1.6] text-body">
          <strong className="text-navy">Open it in this browser.</strong> The link is tied to the browser that asked for
          it, so a link opened on your phone after asking on your laptop won&rsquo;t sign you in.
        </p>
        <p className="text-[12.5px] text-muted">
          Nothing after a few minutes? Check spam, then ask again — the app can only send a few of these an hour.
        </p>
        <p className="mt-1 text-center text-[12.5px] text-body">
          <Link href="/login" className="font-bold text-navy underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-[11px]">
      <FormError message={state?.error} />

      <p className="text-[14px] leading-[1.7] text-body">
        Give us the email you signed up with and we&rsquo;ll send a link to set a new password.
      </p>

      <div>
        <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
        <input
          type="email"
          name="email"
          id="forgot-email"
          autoComplete="email"
          required
          placeholder="you@email.com"
          className={inputClass}
        />
      </div>

      <Turnstile />

      <div className="mt-3">
        <Submit />
      </div>

      <p className="mt-2 text-center text-[12.5px] text-body">
        Remembered it?{" "}
        <Link href="/login" className="font-bold text-navy underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
