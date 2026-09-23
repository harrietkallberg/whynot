import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { db, schema } from "@/db";

import type { OwnerLinkMail, SendOwnerLink } from "./mail";
import { emailOwnerLink, mintOwner } from "./owner";

const ORIGIN = "https://whynot.example";

const mintedOwnerIds: string[] = [];

async function mintTestOwner() {
  const owner = await mintOwner();
  mintedOwnerIds.push(owner.id);
  return owner;
}

afterEach(async () => {
  vi.restoreAllMocks();
  if (mintedOwnerIds.length === 0) return;
  await db
    .delete(schema.owner)
    .where(inArray(schema.owner.id, mintedOwnerIds.splice(0)));
});

/** A sender that records what it was asked to send and sends nothing. */
function recordingSender(outcome: "sent" | "refused" | "throws" = "sent") {
  const sent: OwnerLinkMail[] = [];
  const send: SendOwnerLink = async (mail) => {
    sent.push(mail);
    if (outcome === "throws") throw new Error(`boom for ${mail.to}`);
    return outcome === "sent";
  };
  return { sent, send };
}

describe("emailOwnerLink", () => {
  it("sends the Owner Link to the address the Owner gave", async () => {
    const owner = await mintTestOwner();
    const sender = recordingSender();

    const result = await emailOwnerLink(
      {
        ownerToken: owner.ownerToken,
        email: "  owner@example.com ",
        origin: ORIGIN,
      },
      sender.send,
    );

    expect(result).toBe("sent");
    expect(sender.sent).toEqual([
      {
        to: "owner@example.com",
        ownerLink: `https://whynot.example/d/${owner.ownerToken}`,
      },
    ]);
  });

  it("sends nothing for an Owner Link that belongs to nobody", async () => {
    const sender = recordingSender();

    const result = await emailOwnerLink(
      {
        ownerToken: "1111111111111111111111",
        email: "owner@example.com",
        origin: ORIGIN,
      },
      sender.send,
    );

    expect(result).toBe("unknown-owner");
    expect(sender.sent).toEqual([]);
  });

  it("reports a mail the provider refused as not sent", async () => {
    const owner = await mintTestOwner();
    const sender = recordingSender("refused");

    const result = await emailOwnerLink(
      {
        ownerToken: owner.ownerToken,
        email: "owner@example.com",
        origin: ORIGIN,
      },
      sender.send,
    );

    expect(result).toBe("not-sent");
  });

  it("keeps a sender that throws from rejecting, and logs neither link nor address", async () => {
    const owner = await mintTestOwner();
    const sender = recordingSender("throws");
    const logged = captureConsole();

    const result = await emailOwnerLink(
      {
        ownerToken: owner.ownerToken,
        email: "owner@example.com",
        origin: ORIGIN,
      },
      sender.send,
    );

    expect(result).toBe("not-sent");
    const output = logged();
    expect(output).not.toContain(owner.ownerToken);
    expect(output).not.toContain("owner@example.com");
    expect(output).not.toContain("boom");
  });
});

/** Everything written to the console from here on, as one string. */
function captureConsole(): () => string {
  const calls: unknown[][] = [];
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args) => {
      calls.push(args);
    });
  }
  return () =>
    calls
      .flat()
      .map((arg) =>
        arg instanceof Error
          ? `${arg.message} ${arg.stack}`
          : JSON.stringify(arg),
      )
      .join(" ");
}
