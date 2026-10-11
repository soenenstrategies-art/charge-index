import { redirect } from "next/navigation";

import { AuthShell } from "@/components/brand/AuthShell";
import { createClient } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

const NOTICES: Record<string, string> = {
  confirm: "That link has expired or was already used. Sign in, or ask for a new one.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const notice = typeof params.error === "string" ? NOTICES[params.error] : undefined;

  return (
    <AuthShell
      eyebrow="Welcome back"
      title={
        <>
          Pick up where
          <br />
          you left off
        </>
      }
      lead="Your log lives in the cloud, so you can start on your phone and finish on your laptop."
    >
      <h2 className="mb-6 font-serif text-[28px] font-semibold text-navy">Sign in</h2>
      <LoginForm next={next} notice={notice} />
    </AuthShell>
  );
}
