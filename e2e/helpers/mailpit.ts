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

/**
 * Waits for the confirmation email sent to `email` and returns the path and query of its
 * /auth/confirm link. The host is dropped: the link points at the Supabase Site URL, but
 * the e2e server runs on its own port, so the test opens the path against its baseURL.
 */
export async function confirmPathFor(email: string): Promise<string> {
  const deadline = Date.now() + TIMEOUT_MS;
  let id: string | undefined;
  while (!id) {
    const query = encodeURIComponent(`to:"${email}"`);
    const result = await getJson<SearchResult>(`/api/v1/search?query=${query}`);
    id = result.messages?.[0]?.ID;
    if (!id) {
      if (Date.now() > deadline) throw new Error(`No email for ${email} within ${TIMEOUT_MS} ms`);
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }
  const message = await getJson<Message>(`/api/v1/message/${id}`);
  const body = `${message.HTML ?? ""}\n${message.Text ?? ""}`;
  const match = body.match(/https?:\/\/[^\s"'<>]*\/auth\/confirm\?[^\s"'<>]+/);
  if (!match) throw new Error(`No /auth/confirm link in the email for ${email}`);
  const url = new URL(match[0].replaceAll("&amp;", "&"));
  if (url.pathname !== "/auth/confirm") throw new Error(`Unexpected link path ${url.pathname}`);
  return `${url.pathname}${url.search}`;
}
