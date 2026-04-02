import { NextResponse } from "next/server";

const publicRoutes = [
  "/api/v1/auth/login",
  "/api/v1/users",
  "/api/v1/status",
  "/api/v1/migrations",
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const isPublicBookReadRoute =
    pathname.startsWith("/api/v1/books") && request.method === "GET";

  if (publicRoutes.includes(pathname) || isPublicBookReadRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const decoded = await verifyJwt(token, process.env.JWT_SECRET);

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
