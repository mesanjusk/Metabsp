import { describe, it, expect } from "vitest";
import { __jobOptionsFor } from "./queues";

describe("per-job-type retry policy", () => {
  it("gives single-shot generation jobs enough attempts to outlast a provider overload", () => {
    // Was 3 on a flat 5s exponential, which spent the whole budget 15s after the first failure —
    // no use at all against the 503 Gemini describes as a temporary demand spike. The delay
    // between these attempts is chosen per error; see core/queue/backoff.ts.
    for (const type of ["story", "scene_image", "voice", "render", "thumbnail"] as const) {
      expect(__jobOptionsFor(type).attempts).toBe(5);
      expect(__jobOptionsFor(type).backoff).toEqual({ type: "custom" });
    }
  });

  it("gives browser sessions a single attempt, because the engine retries per step", () => {
    // A whole-job retry would re-run steps that already succeeded — logging in again,
    // re-submitting a form. See the comment in queues.ts.
    expect(__jobOptionsFor("browser_task").attempts).toBe(1);
  });
});
