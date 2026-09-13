import { describe, it, expect } from "vitest";
import { explainJobFailure } from "./explain-failure";
import { isOverloaded } from "./providers/google/gemini-client";

/** Verbatim from the studio screen a customer photographed. */
const LIVE_503 =
  'got status: 503 Service Unavailable. {"error":{"code":503,"message":"This model is currently ' +
  'experiencing high demand. Spikes in demand are usually temporary. Please try again later.",' +
  '"status":"UNAVAILABLE"}}';

const ZERO_ALLOWANCE =
  'got status: 429 Too Many Requests. {"error":{"code":429,"message":"You exceeded your current quota.' +
  '\\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, ' +
  'limit: 0, model: gemini-2.5-flash-preview-image","status":"RESOURCE_EXHAUSTED"}}';

describe("isOverloaded", () => {
  it("recognises the 503 this deployment actually returned", () => {
    expect(isOverloaded(LIVE_503)).toBe(true);
  });

  it("does not mistake a quota error for an overload", () => {
    // These need opposite responses: an overload wants waiting, a quota wants another account.
    expect(isOverloaded(ZERO_ALLOWANCE)).toBe(false);
  });

  it("does not fire on unrelated text that merely contains the words", () => {
    expect(isOverloaded("Scene 3 is unavailable because its asset was deleted")).toBe(false);
    expect(isOverloaded("the character sheet is overloaded with detail")).toBe(false);
  });
});

describe("explainJobFailure", () => {
  it("replaces the raw 503 JSON with something a shop owner can act on", () => {
    const explained = explainJobFailure(LIVE_503);

    expect(explained).not.toContain("503");
    expect(explained).not.toContain("{");
    expect(explained).not.toContain("UNAVAILABLE");
    expect(explained).toMatch(/busy right now/i);
  });

  it("says plainly that a zero allowance is not something waiting fixes", () => {
    const explained = explainJobFailure(ZERO_ALLOWANCE);
    expect(explained).toMatch(/waiting will not change that/i);
    expect(explained).toMatch(/billing|different account/i);
  });

  it("keeps an unrecognised error verbatim rather than hiding it behind a vague phrase", () => {
    // An unclassified error reported exactly is what someone pastes into a support message;
    // "something went wrong" is not.
    const odd = "Scene 4 render exited with code 137";
    expect(explainJobFailure(odd)).toBe(odd);
  });

  it("returns nothing when there was no failure", () => {
    expect(explainJobFailure(undefined)).toBeUndefined();
    expect(explainJobFailure(null)).toBeUndefined();
    expect(explainJobFailure("")).toBeUndefined();
  });
});
