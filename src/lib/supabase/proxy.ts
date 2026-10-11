import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

/**
 * Routes a signed-out visitor may reach. Everything else redirects to /login.
 * /api/cron is machine-to-machine: it has no session and authenticates with
 * its own secret instead (see src/app/api/cron/reminders/route.ts).
 */
// /join is public so an invited person meets a "join your team" page that
// sends them to SIGN UP, rather than the proxy's generic login redirect.
// /forgot-password is public for the obvious reason — someone locked out has
// no session to prove anything with. /reset-password deliberately is NOT:
// it needs the session the emailed link establishes, and that session is
// what proves the person owns the mailbox.
const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth", "/api/cron", "/join", "/forgot-password"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );
}

/**
 * Refreshes the Supabase auth cookie on every request and gates private
 * routes. Auth checks still happen in each page/action — this is the
 * optimistic layer, not the boundary.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Must be getUser(), not getSession() — getUser revalidates the token
  // against Supabase instead of trusting the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
