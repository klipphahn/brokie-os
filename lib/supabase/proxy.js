import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function unauthorizedResponse(request, message = "Authentication required") {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  const pathname = request.nextUrl.pathname;
  const adminEmail = (process.env.ADMIN_EMAIL || "klipphahn@gmail.com").toLowerCase();

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && user && user.email?.toLowerCase() === adminEmail) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (error || !user) {
    return unauthorizedResponse(request);
  }

  if (user.email?.toLowerCase() !== adminEmail) {
    await supabase.auth.signOut();
    return unauthorizedResponse(request, "This account is not authorized for Brokie OS.");
  }

  return response;
}
