import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { runLocalSql } from "./local-sql";

// Made-up people for the integration suites. Each run gets its own ids and
// emails, so runs from several worktrees on the shared stack never collide.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const runId = randomBytes(4).toString("hex");

export type TestClient = SupabaseClient<Database>;
export type TestUser = { id: string; client: TestClient };
export type Families = { f1: string; f2: string; k1: string; invitation: string };

function url(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL as string;
}

function anonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
}

/** A client with no session, as a visitor who is not signed in. */
export function anonClient(): TestClient {
  return createClient<Database>(url(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Signs up a new local user (email confirmations are off locally) and returns its signed-in client. */
export async function createUser(label: string): Promise<TestUser> {
  const client = anonClient();
  const { data, error } = await client.auth.signUp({
    email: `${label}.${runId}@example.test`,
    password: randomBytes(18).toString("base64url"),
    options: { data: { full_name: `${label} example` } },
  });
  if (error) throw error;
  if (!data.user || !data.session) throw new Error(`Sign-up for ${label} returned no session`);
  return { id: data.user.id, client };
}

function sqlUuid(id: string): string {
  if (!UUID.test(id)) throw new Error(`Not a uuid: ${id}`);
  return `'${id}'`;
}

/**
 * F1: owned by `a`, with adults `a` and `b`, a child K1 and a pending invitation.
 * F2: owned by `c`, with adult `c`.
 */
export function createFamilies({ a, b, c }: { a: string; b: string; c: string }): Families {
  const f1 = randomUUID();
  const f2 = randomUUID();
  const k1 = randomUUID();
  const invitation = randomUUID();
  const [A, B, C, F1, F2, K1, I1] = [a, b, c, f1, f2, k1, invitation].map(sqlUuid);
  // A made-up token hash: 64 lowercase hex characters, never a real link.
  const tokenHash = randomBytes(32).toString("hex");
  runLocalSql(`
    begin;
    insert into public.families (id, name, created_by) values
      (${F1}, 'Integration Family One', ${A}),
      (${F2}, 'Integration Family Two', ${C});
    insert into public.family_members (id, family_id, user_id, member_name, member_type, calendar_color) values
      (gen_random_uuid(), ${F1}, ${A}, 'Alex', 'adult', '#1a2b3c'),
      (gen_random_uuid(), ${F1}, ${B}, 'Sam', 'adult', '#2b3c4d'),
      (${K1}, ${F1}, null, 'Kid One', 'child', '#3c4d5e'),
      (gen_random_uuid(), ${F2}, ${C}, 'Jordan', 'adult', '#4d5e6f');
    insert into public.family_invitations (id, family_id, invited_email, invited_by, invitation_token_hash) values
      (${I1}, ${F1}, 'casey.${runId}@example.test', ${A}, '${tokenHash}');
    commit;
  `);
  return { f1, f2, k1, invitation };
}

/** Deletes the families (their members, events and invitations cascade), then the users. */
export function cleanup({ families = [], users = [] }: { families?: string[]; users?: string[] }): void {
  const familyIds = families.map(sqlUuid).join(", ");
  const userIds = users.map(sqlUuid).join(", ");
  runLocalSql(`
    begin;
    ${familyIds ? `delete from public.families where id in (${familyIds});` : ""}
    ${userIds ? `delete from auth.users where id in (${userIds});` : ""}
    commit;
  `);
}
