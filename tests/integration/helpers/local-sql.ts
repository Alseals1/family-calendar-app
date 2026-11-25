import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Runs SQL as the database superuser inside the LOCAL Supabase container.
//
// Why this exists: until the RPCs land (create_family in T07,
// accept_invitation in T08), families and adult family_members cannot be
// created through the API, and CLAUDE.md forbids the service-role key. So the
// integration tests build those fixtures, and clean up afterwards, through
// `docker exec ... psql` on the local stack. Use it for fixtures and cleanup
// only, never for assertions: every assertion goes through supabase-js with a
// real user's JWT.

const CONFIG_PATH = fileURLToPath(new URL("../../../supabase/config.toml", import.meta.url));
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

function projectId(): string {
  const config = readFileSync(CONFIG_PATH, "utf8");
  const match = /^project_id\s*=\s*"([^"]+)"/m.exec(config);
  if (!match) throw new Error(`No project_id in ${CONFIG_PATH}`);
  return match[1];
}

function assertLocalStack(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  const { hostname } = new URL(url);
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`runLocalSql refuses to run: ${hostname} is not a local Supabase stack`);
  }
}

/** Runs `sql` with psql in the local DB container and returns its unaligned output. */
export function runLocalSql(sql: string): string {
  assertLocalStack();
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      `supabase_db_${projectId()}`,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
}
