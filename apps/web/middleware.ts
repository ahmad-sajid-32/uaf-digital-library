import { NextResponse, type NextRequest } from "next/server";

import {
  getAuthStateRouteRedirectPath,
  getProtectedRoleRedirectPath,
  getServerLoginRedirectPath,
} from "@/lib/auth/server-guard";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

function buildRedirectResponse(
  request: NextRequest,
  path: string,
  baseResponse: NextResponse,
): NextResponse {
  const redirectResponse = NextResponse.redirect(new URL(path, request.url));

  baseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabase, getResponse } = createSupabaseMiddlewareClient(request);

  await supabase.auth.getClaims();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const response = getResponse();

  if (pathname === "/login") {
    const redirectPath = getServerLoginRedirectPath(user);

    if (redirectPath) {
      return buildRedirectResponse(request, redirectPath, response);
    }

    return response;
  }

  if (
    pathname === "/auth/verify-required" ||
    pathname === "/auth/access-denied" ||
    pathname === "/auth/session-expired"
  ) {
    const redirectPath = getAuthStateRouteRedirectPath(
      pathname,
      user,
      request.nextUrl.searchParams.get("reason"),
    );

    if (redirectPath) {
      return buildRedirectResponse(request, redirectPath, response);
    }

    return response;
  }

  if (pathname.startsWith("/student")) {
    const redirectPath = getProtectedRoleRedirectPath(user, "student");

    if (redirectPath) {
      return buildRedirectResponse(request, redirectPath, response);
    }

    return response;
  }

  if (pathname.startsWith("/librarian")) {
    const redirectPath = getProtectedRoleRedirectPath(user, "librarian");

    if (redirectPath) {
      return buildRedirectResponse(request, redirectPath, response);
    }

    return response;
  }

  if (pathname.startsWith("/admin")) {
    const redirectPath = getProtectedRoleRedirectPath(user, "admin");

    if (redirectPath) {
      return buildRedirectResponse(request, redirectPath, response);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/auth/verify-required",
    "/auth/access-denied",
    "/auth/session-expired",
    "/student/:path*",
    "/librarian/:path*",
    "/admin/:path*",
  ],
};
