import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function redirectTo(
  request: NextRequest,
  response: NextResponse,
  pathname: string
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));

  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  // TEMPORARY AUTH BYPASS: local Supabase is failing, so allow /dashboard
  // through while testing the clipper. Remove this block to restore protection.
  const bypassAuth = true;
  if (bypassAuth) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isLogin = request.nextUrl.pathname === "/login";

  if (!url || !anonKey) {
    if (isDashboard) {
      return redirectTo(request, NextResponse.next(), "/login");
    }

    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isDashboard) {
    return redirectTo(request, response, "/login");
  }

  if (user && isLogin) {
    return redirectTo(request, response, "/dashboard");
  }

  return response;
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/login"],
};
