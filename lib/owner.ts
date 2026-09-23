import { eq } from "drizzle-orm";

import { db, schema } from "@/db";

import type { SendOwnerLink } from "./mail";
import { hashToken, mintToken } from "./tokens";

/**
 * Owner Link resolution. Possession of the token is the whole credential
 * (ADR-0002), so every page behind an Owner Link comes through here rather
 * than looking the token up itself.
 */

export type Owner = { id: string };

/**
 * The database, or a transaction on it. An Owner row is written alongside the
 * Goal that caused it and the pair has to commit or fail together, so every
 * function here can run inside a caller's transaction.
 */
export type Executor =
  typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The Owner holding this Owner Link, or null when the token belongs to nobody
 * — which is what a caller sees for a guess, a typo, or a link that outlived
 * its row.
 */
export async function resolveOwner(
  ownerToken: string | null | undefined,
  executor: Executor = db,
): Promise<Owner | null> {
  if (!ownerToken) return null;

  const [owner] = await executor
    .select({ id: schema.owner.id })
    .from(schema.owner)
    .where(eq(schema.owner.tokenHash, hashToken(ownerToken)))
    .limit(1);

  return owner ?? null;
}

export type MintedOwner = { id: string; ownerToken: string };

/** Mints a new Owner and returns the only copy of their Owner Link token. */
export async function mintOwner(executor: Executor = db): Promise<MintedOwner> {
  const ownerToken = mintToken();
  const [owner] = await executor
    .insert(schema.owner)
    .values({ tokenHash: hashToken(ownerToken) })
    .returning({ id: schema.owner.id });

  return { id: owner.id, ownerToken };
}

export type EmailOwnerLinkInput = {
  ownerToken: string;
  email: string;
  /** Where the app is served, such as https://whynot.example. */
  origin: string;
};

export type EmailOwnerLinkResult = "sent" | "unknown-owner" | "not-sent";

/**
 * Records the address an Owner asked their link to be sent to, and sends the
 * link there. Email never gates the main flow (ADR-0002), so this resolves
 * whatever happens to the mail: "not-sent" is a state to show the Owner, and
 * they still hold the link on screen. `send` is passed in so nothing but the
 * app itself ever sends real mail.
 */
export async function emailOwnerLink(
  { ownerToken, email, origin }: EmailOwnerLinkInput,
  send: SendOwnerLink,
): Promise<EmailOwnerLinkResult> {
  const owner = await resolveOwner(ownerToken);
  if (!owner) return "unknown-owner";

  const to = email.trim();
  await db
    .update(schema.owner)
    .set({ email: to })
    .where(eq(schema.owner.id, owner.id));

  try {
    const sent = await send({ to, ownerLink: `${origin}/d/${ownerToken}` });
    return sent ? "sent" : "not-sent";
  } catch {
    // A sender is supposed to resolve false rather than throw, but this is the
    // last place a failure can be kept from becoming a failed request. The
    // error is dropped: it was raised on a mail carrying an Owner Link and an
    // address, and neither may reach a log (ADR-0002).
    return "not-sent";
  }
}
