import { afterEach, describe, expect, it, vi } from "vitest";

import { resendSender, senderFromEnv } from "./mail";

const MAIL = {
  to: "owner@example.com",
  ownerLink: "https://whynot.example/d/7hK2mPq9Rt4vWx8yZa3bCd",
};

/**
 * Stands in for Resend's HTTP API, so the suite never sends real mail and
 * needs no key. Records every request the client makes.
 */
function stubResend(respond: () => Response | Promise<Response>) {
  const requests: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      requests.push({ url: String(url), init });
      return respond();
    }),
  );
  return requests;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("resendSender", () => {
  it("sends the Owner Link from the configured sender to the Owner", async () => {
    const requests = stubResend(() => json(200, { id: "email-id" }));
    const send = resendSender({
      apiKey: "re_test_key",
      from: "WhyNot <links@whynot.example>",
    });

    await expect(send(MAIL)).resolves.toBe(true);

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(requests[0].init.body));
    expect(body.from).toBe("WhyNot <links@whynot.example>");
    expect(body.to).toBe("owner@example.com");
    expect(body.subject).toBeTruthy();
    expect(body.text).toContain(MAIL.ownerLink);
  });

  it("reports a refused mail as not sent, and logs nothing about it", async () => {
    // What Resend answers when the resend.dev sender is used for anybody but
    // the account's own address. Its message names addresses.
    stubResend(() =>
      json(403, {
        statusCode: 403,
        name: "validation_error",
        message:
          "You can only send testing emails to your own email address (account@example.com). Not owner@example.com.",
      }),
    );
    const logged = captureConsole();

    await expect(send(MAIL)).resolves.toBe(false);

    expect(logged()).toBe("");
  });

  it("reports an unreachable Resend as not sent, and logs nothing about it", async () => {
    stubResend(() => {
      throw new TypeError(`fetch failed for ${MAIL.to} ${MAIL.ownerLink}`);
    });
    const logged = captureConsole();

    await expect(send(MAIL)).resolves.toBe(false);

    expect(logged()).toBe("");
  });
});

describe("senderFromEnv", () => {
  it("uses RESEND_API_KEY, and Resend's shared sender until MAIL_FROM names a verified one", async () => {
    const requests = stubResend(() => json(200, { id: "email-id" }));

    await senderFromEnv({ RESEND_API_KEY: "re_env_key" })(MAIL);
    await senderFromEnv({
      RESEND_API_KEY: "re_env_key",
      MAIL_FROM: "WhyNot <links@whynot.example>",
    })(MAIL);

    const [first, second] = requests.map((request) => ({
      from: JSON.parse(String(request.init.body)).from,
      auth: new Headers(request.init.headers).get("authorization"),
    }));
    expect(first).toEqual({
      from: "WhyNot <onboarding@resend.dev>",
      auth: "Bearer re_env_key",
    });
    expect(second.from).toBe("WhyNot <links@whynot.example>");
  });

  it("sends nothing, and says so, when no key is configured", async () => {
    const requests = stubResend(() => json(200, { id: "email-id" }));
    const logged = captureConsole();

    await expect(senderFromEnv({})(MAIL)).resolves.toBe(false);

    expect(requests).toEqual([]);
    expect(logged()).toBe("");
  });
});

const send = (mail: typeof MAIL) =>
  resendSender({
    apiKey: "re_test_key",
    from: "WhyNot <links@whynot.example>",
  })(mail);

/** Everything written to the console from here on, as one string. */
function captureConsole(): () => string {
  const calls: unknown[][] = [];
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args) => {
      calls.push(args);
    });
  }
  return () => calls.flat().map(String).join(" ");
}
