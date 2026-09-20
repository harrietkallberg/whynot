import { cookies } from "next/headers";

import { mintToken } from "@/lib/tokens";

/**
 * How a browser is recognised as one that has already answered a Goal.
 *
 * The cookie holds a random token and nothing else: no Goal, no Response, no
 * timestamp. It is turned into a per-Goal hash before it reaches the database
 * (see browserHashFor), so possession of the cookie reveals nothing and the
 * stored guard cannot be joined up across Goals.
 *
 * It is scoped to the Response Links, so it is never sent to a Dashboard, and
 * httpOnly so no page script can read it back out.
 */
export const BROWSER_COOKIE = "whynot.browser";

const COOKIE_PATH = "/r";

/** A year. Long enough that "once per browser" means something. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The token this browser already carries, or null. */
export async function readBrowserToken(): Promise<string | null> {
  return (await cookies()).get(BROWSER_COOKIE)?.value ?? null;
}

/**
 * The token this browser carries, minting and setting one when there is none.
 * Only callable where a response header can still be written — a Server
 * Function or a Route Handler.
 */
export async function claimBrowserToken(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(BROWSER_COOKIE)?.value;
  if (existing) return existing;

  const browserToken = mintToken();
  cookieStore.set(BROWSER_COOKIE, browserToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE,
  });

  return browserToken;
}
