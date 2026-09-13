import type { Job as BullJob } from "bullmq";
import type { JobType } from "@/lib/video/modules/jobs/models/Job";
import type { BullJobData } from "./processors/helpers";
import { processSceneVideoAutoJob } from "./processors/scene-video-auto.processor";
import { processBrowserTaskJob } from "./processors/browser-task.processor";

/**
 * Job types that must NEVER be registered in core/queue/processors/index.ts.
 *
 * Everything here transitively imports Playwright — see core/browser/ and
 * core/ai/providers/google/google-flow-automated.ts — which needs a real browser binary on the
 * host. The shared registry is started on every instance; this one is started only where
 * VIDEO_BROWSER_WORKER says a browser exists (lib/runtime/backgroundJobs.ts).
 *
 * If a job of one of these types is enqueued while nothing consumes it, it simply stays "queued" —
 * visible on the jobs list — until a browser-capable instance runs, or the operator falls back to
 * the Chrome-extension hand-off, which needs no server-side browser at all. That is an honest
 * degrade rather than a silent failure.
 */
export const workerOnlyProcessorRegistry: Partial<Record<JobType, (job: BullJob<BullJobData>) => Promise<unknown>>> = {
  scene_video_auto: processSceneVideoAutoJob,
  browser_task: processBrowserTaskJob,
};
