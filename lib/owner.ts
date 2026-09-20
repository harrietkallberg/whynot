import { eq } from "drizzle-orm";

import { db, schema } from "@/db";

import { hashToken, mintToken } from "./tokens";

/**
 * Owner Link resolution. Possession of the token is the whole credential
 * (ADR-0002), so every page behind an Owner Link comes through here rather
 * than looking the token up itself.
 */

export type Owner = { id: string };

/**
 * The Owner holding this Owner Link, or null when the token belongs to nobody
 * — which is what a caller sees for a guess, a typo, or a link that outlived
 * its row.
 */
export async function resolveOwner(
  ownerToken: string | null | undefined,
): Promise<Owner | null> {
  if (!ownerToken) return null;

  const [owner] = await db
    .select({ id: schema.owner.id })
    .from(schema.owner)
    .where(eq(schema.owner.tokenHash, hashToken(ownerToken)))
    .limit(1);

  return owner ?? null;
}

export type MintedOwner = { id: string; ownerToken: string };

/** Mints a new Owner and returns the only copy of their Owner Link token. */
export async function mintOwner(): Promise<MintedOwner> {
  const ownerToken = mintToken();
  const [owner] = await db
    .insert(schema.owner)
    .values({ tokenHash: hashToken(ownerToken) })
    .returning({ id: schema.owner.id });

  return { id: owner.id, ownerToken };
}

/**
 * Records the address an Owner asked their link to be sent to. Nothing is sent
 * from here: no mail provider has been chosen yet, and email never gates the
 * main flow (ADR-0002).
 */
export async function setOwnerEmail(
  ownerToken: string,
  email: string,
): Promise<boolean> {
  const owner = await resolveOwner(ownerToken);
  if (!owner) return false;

  await db
    .update(schema.owner)
    .set({ email: email.trim() })
    .where(eq(schema.owner.id, owner.id));

  return true;
}
