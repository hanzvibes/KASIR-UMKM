import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/env";

export async function middleware(request: NextRequest) {
  const env = getSupabasePublicEnv();
  const pathname = request.nextUrl.pathname;
  if (pathname === "/login") {
    if (!env.configured) return NextResponse.next();
  } else if (!env.configured) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("setup", "supabase");
    return NextResponse.redirect(loginUrl);
  }

  if (!env.configured) return NextResponse.next();

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
  if (!user && pathname !== "/login") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const { data: memberships, error: membershipError } = await supabase.rpc("kasir_get_my_business");
    const destination = request.nextUrl.clone();
    // Do not send existing users into onboarding when membership lookup itself failed.
    destination.pathname = membershipError ? pathname : memberships?.length ? "/" : "/onboarding";
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  if (user && pathname !== "/onboarding") {
    const { data: memberships, error: membershipError } = await supabase.rpc("kasir_get_my_business");
    if (!membershipError && (!memberships || memberships.length === 0)) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      onboardingUrl.search = "";
      return NextResponse.redirect(onboardingUrl);
    }
  }

  if (user && pathname === "/onboarding") {
    const { data: memberships, error: membershipError } = await supabase.rpc("kasir_get_my_business");
    if (!membershipError && memberships && memberships.length > 0) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
