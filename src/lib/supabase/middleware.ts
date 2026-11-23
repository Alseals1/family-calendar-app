import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/**
 * Refreshes the Supabase session cookies for a request. It only refreshes: it
 * never redirects. Route protection is added with the auth gate (T05).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { url, anonKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

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
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getUser: it refreshes the session.
  await supabase.auth.getUser();

  return response;
}
