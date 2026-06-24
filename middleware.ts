import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

const { auth } = NextAuth({
  ...authConfig,
  trustHost: true,
});

const publicRoutes = ["/login", "/register"];
const authRoutes = ["/login", "/register"];

function hasValidSession(authSession: { user?: { id?: string; agencyId?: string } } | null) {
  return !!(authSession?.user?.id && authSession.user.agencyId);
}

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));
  const isApiAuth = pathname.startsWith("/api/auth");
  const isPublicApi =
    pathname.startsWith("/api/integrations/google-calendar/webhook") ||
    pathname.startsWith("/api/google-calendar/callback") ||
    pathname.startsWith("/api/integrations/google-calendar/callback");
  const validSession = hasValidSession(req.auth);

  if (isApiAuth || isPublicApi) {
    return NextResponse.next();
  }

  if (isAuthRoute) {
    if (validSession) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  if (!validSession && !isPublicRoute) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
