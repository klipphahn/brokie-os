import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/merch",
  "/storefront",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/storefront/featured",
  "/api/cron"
];

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function clearStaleAuthCookies(request, response) {
  request.cookies.getAll().forEach(({ name }) => {
    if (name.startsWith("sb-") && name.includes("auth-token")) {
      response.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:"
      });
    }
  });

  return response;
}

function unauthorizedResponse(
  request,
  message = "Authentication required",
  { clearSession = false } = {}
) {
  let response;

  if (request.nextUrl.pathname.startsWith("/api/")) {
    response = NextResponse.json({ ok: false, error: message }, { status: 401 });
  } else {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    response = NextResponse.redirect(url);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return clearSession
    ? clearStaleAuthCookies(request, response)
    : response;
}

export async function updateSession(request) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const adminEmail = (process.env.ADMIN_EMAIL || "klipphahn@gmail.com").toLowerCase();
  const hasSupabaseCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasSupabaseCredentials) {
    if (isPublicPath(pathname)) {
      return response;
    }

    return unauthorizedResponse(request);
  }

  // Public storefront and cron routes never need to refresh an admin session.
  // Skipping auth here prevents stale browser cookies from breaking public merch.
  if (isPublicPath(pathname) && pathname !== "/login") {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, cacheHeaders = {}) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          Object.entries(cacheHeaders).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  let data;
  let error;

  try {
    const result = await supabase.auth.getUser();
    data = result.data;
    error = result.error;
  } catch (authError) {
    error = authError;
  }

  const user = data?.user;

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && user && user.email?.toLowerCase() === adminEmail) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return error
      ? clearStaleAuthCookies(request, response)
      : response;
  }

  if (error || !user) {
    return unauthorizedResponse(request, "Authentication required", {
      clearSession: Boolean(error)
    });
  }

  if (user.email?.toLowerCase() !== adminEmail) {
    await supabase.auth.signOut();
    return unauthorizedResponse(
      request,
      "This account is not authorized for Brokie OS.",
      { clearSession: true }
    );
  }

  return response;
}
