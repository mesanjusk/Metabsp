import { describe, it, expect } from "vitest";
import { computeBackoffMs, isOverloadError, MAX_BACKOFF_MS } from "./backoff";
import { ProviderOverloadedError, ProviderQuotaExceededError } from "@/lib/video/core/ai/types";

/**
 * The exact body Gemini returned live, from a customer's screenshot of the studio screen. Kept
 * verbatim: the classifier's whole job is to recognise this shape, so a paraphrase would test
 * nothing.
 */
const LIVE_503 =
  'got status: 503 Service Unavailable. {"error":{"code":503,"message":"This model is currently ' +
  'experiencing high demand. Spikes in demand are usually temporary. Please try again later.",' +
  '"status":"UNAVAILABLE"}}';

/** Total wall-clock patience across `attempts` tries, ignoring jitter's effect on the mean. */
function totalPatienceMs(attempts: number, err?: unknown): number {
  let total = 0;
  for (let attempt = 1; attempt < attempts; attempt += 1) total += computeBackoffMs(attempt, err);
  return total;
}

describe("retry backoff", () => {
  it("waits minutes on a provider overload, not seconds", () => {
    const err = new ProviderOverloadedError("gemini", LIVE_503);

    // The bug this exists to prevent: three attempts on a 5s exponential gave up 15s after the
    // first failure, against an error that says demand spikes are temporary.
    expect(totalPatienceMs(5, err)).toBeGreaterThan(6 * 60_000);
  });

  it("still fails fast on an ordinary error, so a real bug surfaces quickly", () => {
    const total = totalPatienceMs(5, new Error("Project not found"));
    expect(total).toBeLessThan(2 * 60_000);
  });

  it("grows with each attempt", () => {
    const err = new ProviderOverloadedError("gemini");
    // Jitter is ±20%, so consecutive attempts can only be compared with that slack allowed.
    expect(computeBackoffMs(3, err)).toBeGreaterThan(computeBackoffMs(1, err));
  });

  it("never waits longer than the ceiling", () => {
    const err = new ProviderOverloadedError("gemini");
    for (const attempt of [8, 12, 40]) {
      expect(computeBackoffMs(attempt, err)).toBeLessThanOrEqual(MAX_BACKOFF_MS);
    }
  });

  it("spreads simultaneous retries, so a project's scenes do not all return at once", () => {
    const err = new ProviderOverloadedError("gemini");
    const delays = new Set(Array.from({ length: 40 }, () => computeBackoffMs(2, err)));
    // Every scene in a project fails at the same instant when the provider goes down; identical
    // delays would aim all of them at the recovering service together.
    expect(delays.size).toBeGreaterThan(1);
  });

  it("treats a quota error as ordinary, because rotating accounts fixes it and waiting does not", () => {
    expect(isOverloadError(new ProviderQuotaExceededError("gemini"))).toBe(false);
    expect(isOverloadError(new ProviderOverloadedError("gemini"))).toBe(true);
  });
});
