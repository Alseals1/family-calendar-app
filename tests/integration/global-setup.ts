import { execFileSync } from "node:child_process";

const NOT_RUNNING = "Local Supabase is not running. Start it with: npx supabase start";
const CLI_FAILED =
  "Could not read `supabase status`. Is the stack running (npx supabase start), and is Supabase CLI 2.75+ first on PATH?";

function readStatusEnv(): Record<string, string> {
  let output: string;
  try {
    output = execFileSync("supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    // Only stderr is reported: stdout holds the keys.
    const stderr = (error as { stderr?: string }).stderr?.toString().trim();
    throw new Error(stderr ? `${CLI_FAILED}\nCLI said: ${stderr}` : CLI_FAILED);
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
