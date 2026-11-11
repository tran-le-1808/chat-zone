import { NextRequest, NextResponse } from "next/server";
import {
  REDIRECT_PARAM,
  authUrlWithRedirect,
  getSafeRedirect,
} from "./lib/redirect";

const publicRoutes = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  const pathname = request.nextUrl.pathname;

  const isPublicRoute = publicRoutes.includes(pathname);

  // Allow public routes
  if (isPublicRoute) {
    // Logged in user cannot access login/register
    // (nếu có ?redirect= thì về đúng trang đó)
    if (token) {
      const target = getSafeRedirect(
        request.nextUrl.searchParams.get(REDIRECT_PARAM),
      );
      return NextResponse.redirect(new URL(target, request.url));
    }

    return NextResponse.next();
  }

  // Protect only existing private routes
  const protectedRoutes = ["/", "/profile", "/chat", "/dashboard", "/games"];

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // User not logged in -> về trang login, nhớ trang đang mở để quay lại sau khi đăng nhập
  if (!token && isProtectedRoute) {
    const from = `${pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(
      new URL(authUrlWithRedirect("/login", from), request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
