import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Auth pages that don't require login
  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  // Public API routes
  const isPublicApi = pathname.startsWith("/api/auth");

  // Dev-only API routes (test generation)
  const isDevApi = process.env.NODE_ENV === 'development' && pathname.startsWith("/api/tests/generate");

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && isAuthPage) {
    return Response.redirect(new URL("/", req.url));
  }

  // Allow public API routes and dev-only routes
  if (isPublicApi || isDevApi) {
    return;
  }

  // Protect all other routes - redirect to login if not authenticated
  if (!isLoggedIn && !isAuthPage) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.png$|.*\\.svg$).*)",
  ],
};
