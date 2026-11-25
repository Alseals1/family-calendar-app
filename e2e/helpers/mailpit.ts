// Reads the local Mailpit inbox that the Supabase CLI starts. Local, made-up data only.
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

const POLL_MS = 500;
const TIMEOUT_MS = 15_000;

type SearchResult = { messages?: { ID: string }[] };
type Message = { HTML?: string; Text?: string };

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}${path}`);
  if (!response.ok) throw new Error(`Mailpit ${path} returned ${response.status}`);
  return (await response.json()) as T;
}

export type AuthLinkType = "email" | "recovery";

/** The /auth/confirm link in a message body whose `type` param is `type`, as path and query. */
function confirmLinkIn(message: Message, type: AuthLinkType): string | undefined {
  const body = `${message.HTML ?? ""}\n${message.Text ?? ""}`;
  const links = body.match(/https?:\/\/[^\s"'<>]*\/auth\/confirm\?[^\s"'<>]+/g) ?? [];
  for (const link of links) {
    const url = new URL(link.replaceAll("&amp;", "&"));
    if (url.pathname === "/auth/confirm" && url.searchParams.get("type") === type) {
      return `${url.pathname}${url.search}`;
    }
  }
  return undefined;
}

/**
 * Waits for an email sent to `email` that holds an /auth/confirm link of the given type
 * and returns the link's path and query. An address can get several emails (confirmation,
 * then reset), so each message is checked, newest first. The host is dropped: the link
 * points at the Supabase Site URL, but the e2e server runs on its own port, so the test
 * opens the path against its baseURL.
 */
export async function authLinkPathFor(email: string, type: AuthLinkType): Promise<string> {
  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    const query = encodeURIComponent(`to:"${email}"`);
    const result = await getJson<SearchResult>(`/api/v1/search?query=${query}`);
    for (const { ID } of result.messages ?? []) {
      const link = confirmLinkIn(await getJson<Message>(`/api/v1/message/${ID}`), type);
      if (link) return link;
    }
    if (Date.now() > deadline) {
      throw new Error(`No ${type} link in an email for ${email} within ${TIMEOUT_MS} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

/** The confirmation link from the sign-up email. */
export function confirmPathFor(email: string): Promise<string> {
  return authLinkPathFor(email, "email");
}

/** The link from the password-reset email. */
export function recoveryPathFor(email: string): Promise<string> {
  return authLinkPathFor(email, "recovery");
}
