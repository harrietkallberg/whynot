import { Resend } from "resend";

/** One Owner Link on its way to the address its Owner gave. */
export type OwnerLinkMail = { to: string; ownerLink: string };

/**
 * Sends one Owner Link. Resolves true when the provider accepted the mail and
 * false when it did not; it never rejects.
 */
export type SendOwnerLink = (mail: OwnerLinkMail) => Promise<boolean>;

/**
 * Resend's shared sender. It delivers only to the address on the Resend
 * account and refuses everybody else, so it serves until a domain is verified
 * and MAIL_FROM names a sender on it.
 */
const SHARED_SENDER = "WhyNot <onboarding@resend.dev>";

/**
 * The sender the app uses, configured by the environment: RESEND_API_KEY for
 * the credential and MAIL_FROM for the From line. With no key it sends
 * nothing and says so, which an Owner sees as a mail that could not be sent.
 */
export function senderFromEnv(
  env: Record<string, string | undefined> = process.env,
): SendOwnerLink {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return async () => false;

  return resendSender({ apiKey, from: env.MAIL_FROM || SHARED_SENDER });
}

export type ResendConfig = { apiKey: string; from: string };

/** A sender that hands each Owner Link to Resend. */
export function resendSender({ apiKey, from }: ResendConfig): SendOwnerLink {
  const resend = silenced(new Resend(apiKey));

  return async ({ to, ownerLink }) => {
    try {
      const { error } = await resend.emails.send({
        from,
        to,
        subject: "Your WhyNot Owner Link",
        text: ownerLinkText(ownerLink),
      });
      return error === null;
    } catch {
      // Dropped, not logged: it was raised on a request carrying an Owner
      // Link and an address (ADR-0002).
      return false;
    }
  };
}

/**
 * Outside production the Resend client prints every error response it gets
 * with console.error, and those responses name addresses: the one Resend sends
 * for an unverified sender quotes both the account's address and the
 * recipient's. Nothing about a send may reach a log, so that printing is
 * switched off on this instance. lib/mail.test.ts fails if an upgrade brings
 * it back under another name.
 */
function silenced(resend: Resend): Resend {
  (resend as unknown as { logError: () => void }).logError = () => {};
  return resend;
}

function ownerLinkText(ownerLink: string): string {
  return [
    "Here is the Owner Link you asked us to send you:",
    "",
    ownerLink,
    "",
    "It opens your Dashboard, where every Goal you created with it is listed.",
    "There is no account and no password: this link is the only way back, and",
    "anyone who has it can read your Reports. Keep this mail somewhere safe and",
    "do not forward it.",
  ].join("\n");
}
