import { execFileSync } from "node:child_process";

const NOT_RUNNING = "Local Supabase is not running. Start it with: npx supabase start";

function readStatusEnv(): Record<string, string> {
  let output: string;
  try {
    output = execFileSync("supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error(NOT_RUNNING);
  }
  const values: Record<string, string> = {};
  for (const line of output.split("\n")) {
    const match = /^([A-Z_]+)="(.*)"$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return values;
}

export default function setup() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return;
  }
  const status = readStatusEnv();
  if (!status.API_URL || !status.ANON_KEY) throw new Error(NOT_RUNNING);
  process.env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = status.ANON_KEY;
}
