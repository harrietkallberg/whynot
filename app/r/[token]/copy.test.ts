import { describe, expect, it } from "vitest";

import { ANONYMITY_PROMISE } from "./copy";

/**
 * The sentence a Respondent decides to be honest on. ADR-0005 fixes what it
 * may and may not claim, so the load-bearing parts are pinned here: changing
 * any of them should mean rereading that ADR, not just updating a snapshot.
 */
describe("the promise made to a Respondent", () => {
  it("says an AI model summarises the answer", () => {
    expect(ANONYMITY_PROMISE).toMatch(/\bAI model\b/);
  });

  it("says a summary is only made once enough answers have come in", () => {
    expect(ANONYMITY_PROMISE).toMatch(/until enough other answers/);
  });

  it("says the answer is never shown on its own", () => {
    expect(ANONYMITY_PROMISE).toMatch(/never shown on its own/);
  });

  it("says the person who sent the link never sees what was written", () => {
    expect(ANONYMITY_PROMISE).toMatch(
      /the person who sent you this link will never see what you wrote/,
    );
  });

  it("claims nothing about the model provider retaining or training on it", () => {
    // Zero Data Retention is not available on this project's plan, so no
    // such promise can be kept (ADR-0005).
    expect(ANONYMITY_PROMISE).not.toMatch(
      /retain|retention|train|stor|delet|discard|kept|keep|log|privat|secure|encrypt|third part|provider|share|sold|sell/i,
    );
  });
});
