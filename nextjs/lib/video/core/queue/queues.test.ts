import { describe, it, expect } from "vitest";
import { __jobOptionsFor } from "./queues";

describe("per-job-type retry policy", () => {
  it("keeps the studio's 3-attempt backoff for single-shot generation jobs", () => {
    for (const type of ["story", "scene_image", "voice", "render", "thumbnail"] as const) {
      expect(__jobOptionsFor(type).attempts).toBe(3);
    }
  });

  it("gives browser sessions a single attempt, because the engine retries per step", () => {
    // A whole-job retry would re-run steps that already succeeded — logging in again,
    // re-submitting a form. See the comment in queues.ts.
    expect(__jobOptionsFor("browser_task").attempts).toBe(1);
  });
});
