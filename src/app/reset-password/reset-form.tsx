"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updatePassword } from "@/app/auth/actions";
import { FieldLabel, FormError, SubmitButton, inputClass } from "@/components/AppShell";

function Submit() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Save my new password</SubmitButton>;
}

export function ResetForm() {
  const [state, formAction] = useActionState(updatePassword, null);

  return (
    <form action={formAction} className="flex flex-col gap-[11px]">
      <FormError message={state?.error} />

      <div>
        <FieldLabel htmlFor="reset-password">New password</FieldLabel>
        <input
          type="password"
          name="password"
          id="reset-password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
        <p className="mt-[5px] text-[11px] text-muted">At least 8 characters.</p>
      </div>

      <div>
        <FieldLabel htmlFor="reset-confirm">Type it again</FieldLabel>
        <input
          type="password"
          name="confirm"
          id="reset-confirm"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
      </div>

      <div className="mt-3">
        <Submit />
      </div>
    </form>
  );
}
