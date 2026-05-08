import { jwtVerify } from "jose";
import { type NextRequest, NextResponse } from "next/server";

type RouteContext = { pathname: string; method: string };

const publicRouteMatchers: Array<(ctx: RouteContext) => boolean> = [
  ({ pathname, method }) =>
    pathname === "/api/v1/auth/login" && method === "POST",
  ({ pathname, method }) =>
    pathname === "/api/v1/auth/logout" && method === "POST",
  ({ pathname, method }) => pathname === "/api/v1/status" && method === "GET",
  ({ pathname, method }) => pathname === "/api/v1/users" && method === "POST",
];

const adminRouteMatchers: Array<(ctx: RouteContext) => boolean> = [
  ({ pathname }) => pathname === "/api/v1/migrations",
  ({ pathname, method }) =>
    pathname.startsWith("/api/v1/books") &&
    ["POST", "PUT", "DELETE"].includes(method),
  ({ pathname }) => pathname.startsWith("/api/v1/students"),
  ({ pathname }) => pathname.startsWith("/api/v1/loans"),
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { method } = request;

  const isPublicBookReadRoute =
    pathname.startsWith("/api/v1/books") && method === "GET";
  const isPublicRoute = publicRouteMatchers.some((matcher) =>
    matcher({ pathname, method }),
  );

  if (isPublicRoute || isPublicBookReadRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const decoded = payload as { id: string; papel: string };

    const isAdminRoute = adminRouteMatchers.some((matcher) =>
      matcher({ pathname, method }),
    );

    if (isAdminRoute && decoded.papel !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", decoded.id);
    requestHeaders.set("x-user-role", decoded.papel);

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return NextResponse.json(
      { error: "Token inválido ou expirado." },
      { status: 401 },
    );
  }
}

export const config = {
  matcher: "/api/v1/:path*",
};
