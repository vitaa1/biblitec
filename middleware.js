import { NextResponse } from "next/server";

const publicRouteMatchers = [
  ({ pathname, method }) =>
    pathname === "/api/v1/auth/login" && method === "POST",
  ({ pathname, method }) => pathname === "/api/v1/status" && method === "GET",
  ({ pathname, method }) => pathname === "/api/v1/users" && method === "POST",
];

const adminRouteMatchers = [
  ({ pathname }) => pathname === "/api/v1/migrations",
  ({ pathname, method }) =>
    pathname.startsWith("/api/v1/books") &&
    ["POST", "PUT", "DELETE"].includes(method),
  ({ pathname }) => pathname.startsWith("/api/v1/students"),
  ({ pathname }) => pathname.startsWith("/api/v1/loans"),
];

export async function middleware(request) {
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
    const decoded = await verifyJwt(token, process.env.JWT_SECRET);
    const isAdminRoute = adminRouteMatchers.some((matcher) =>
      matcher({ pathname, method }),
    );

    if (isAdminRoute && decoded.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", decoded.id);
    requestHeaders.set("x-user-role", decoded.role);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Token inválido ou expirado." },
      { status: 401 },
    );
  }
}

async function verifyJwt(token, secret) {
  const [headerB64, payloadB64, signatureB64] = token.split(".");

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signatureBytes = base64UrlDecode(signatureB64);
  const data = encoder.encode(`${headerB64}.${payloadB64}`);

  const valid = await crypto.subtle.verify(
    "HMAC",
    cryptoKey,
    signatureBytes,
    data,
  );

  if (!valid) {
    throw new Error("Assinatura inválida.");
  }

  const payload = JSON.parse(
    atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")),
  );

  if (payload.exp && Date.now() / 1000 > payload.exp) {
    throw new Error("Token expirado.");
  }

  return payload;
}

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export const config = {
  matcher: "/api/v1/:path*",
};
