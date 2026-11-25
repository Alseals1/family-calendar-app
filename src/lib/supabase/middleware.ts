import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { proxyRedirect } from "@/lib/auth/redirects";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/**
 * Refreshes the Supabase session cookies for a request, then applies route
 * protection (see proxyRedirect): signed-out visitors go to /login, signed-in
 * visitors leave /login and /register. Redirects keep the refreshed cookies and
 * no-store headers.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { url, anonKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });
  // Only the headers setAll receives are copied to a redirect. Copying all of
  // response's headers would also copy x-middleware-next and make Next render the page.
  let refreshedHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Cache-Control: no-store and friends. Without them a CDN could cache the
        // Set-Cookie response and serve one adult's session to another.
        refreshedHeaders = headers;
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getUser: it refreshes the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const target = proxyRedirect({
    pathname: request.nextUrl.pathname,
    isAuthenticated: user !== null,
  });
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  Object.entries(refreshedHeaders).forEach(([key, value]) => redirect.headers.set(key, value));
  return redirect;
}
