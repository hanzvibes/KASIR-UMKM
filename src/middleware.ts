import { createServerClient } from "@supabase/ssr";
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
      setAll(cookiesToSet) {
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
    const { data: membership } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
    const destination = request.nextUrl.clone();
    destination.pathname = membership ? "/" : "/onboarding";
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  if (user && pathname !== "/onboarding") {
    const { data: membership } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (!membership) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      onboardingUrl.search = "";
      return NextResponse.redirect(onboardingUrl);
    }
  }

  if (user && pathname === "/onboarding") {
    const { data: membership } = await supabase.from("business_members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (membership) {
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
