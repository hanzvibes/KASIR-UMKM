import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/env";

export async function middleware(request: NextRequest) {
  const env = getSupabasePublicEnv();
  const pathname = request.nextUrl.pathname;

  if (!env.configured) {
    if (pathname === "/login") return NextResponse.next();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("setup", "supabase");
    return NextResponse.redirect(loginUrl);
  }

  // Feature pages and server actions already validate the user themselves.
  // Avoid a second auth network request on every normal navigation; only auth
  // entry points need middleware-level session routing.
  if (pathname !== "/login" && pathname !== "/onboarding") return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && pathname === "/onboarding") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/login" || pathname === "/onboarding")) {
    const { data: memberships, error: membershipError } = await supabase.rpc("kasir_get_my_business");
    if (membershipError) return response;
    const destination = request.nextUrl.clone();
    destination.pathname = memberships?.length ? "/checkout" : "/onboarding";
    destination.search = "";
    if (pathname !== destination.pathname) return NextResponse.redirect(destination);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
