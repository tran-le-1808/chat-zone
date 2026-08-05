import { NextRequest, NextResponse } from "next/server";

const publicRoutes = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  const pathname = request.nextUrl.pathname;

  const isPublicRoute = publicRoutes.includes(pathname);

  // Allow public routes
  if (isPublicRoute) {
    // Logged in user cannot access login/register
    if (token) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  // Protect only existing private routes
  const protectedRoutes = ["/", "/profile", "/chat", "/dashboard"];

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // User not logged in
  if (!token && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
