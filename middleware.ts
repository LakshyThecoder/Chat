import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { parsePublicEnv } from "@/src/config/env";
import {
  CORRELATION_ID_HEADER,
  generateCorrelationId,
  getCorrelationIdFromHeaders,
} from "@/src/infrastructure/observability/correlation";

function isAlwaysAllowedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/providers/flyright")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const correlationId =
    getCorrelationIdFromHeaders(request.headers) ?? generateCorrelationId();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_ID_HEADER, correlationId);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(CORRELATION_ID_HEADER, correlationId);

  // Hackathon demo lock: keep the judge on a single, reliable surface.
  // In development we allow navigating the full Bureau; in production, non-demo pages redirect to `/`.
  if (process.env.NODE_ENV === "production") {
    const pathname = request.nextUrl.pathname;
    if (!isAlwaysAllowedPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url, { status: 307, headers: { [CORRELATION_ID_HEADER]: correlationId } });
    }
  }

  const env = parsePublicEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: Record<string, unknown>;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.headers.set(CORRELATION_ID_HEADER, correlationId);
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as never);
          });
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
