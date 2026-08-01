import { NextRequest, NextResponse } from "next/server";

// Cheap cookie-presence gate only. This can run on the CDN, so it must not touch
// the database — real authorization happens in the route handlers and layouts.
const COOKIE = "rebuy_session";

export function proxy(req: NextRequest) {
  const signedIn = Boolean(req.cookies.get(COOKIE)?.value);
  const { pathname, search } = req.nextUrl;

  if (pathname === "/login" && signedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (pathname !== "/login" && !signedIn) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/add/:path*", "/items/:path*", "/payments/:path*", "/prava/:path*", "/login"],
};
