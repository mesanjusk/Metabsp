import type { Job as BullJob } from "bullmq";
import type { JobType } from "@/lib/video/modules/jobs/models/Job";
import type { BullJobData } from "./helpers";
import { processStoryJob } from "./story.processor";
import { processCharacterImageJob } from "./character-image.processor";
import { processBackgroundImageJob } from "./background-image.processor";
import { processSceneImageJob } from "./scene-image.processor";
import { processSceneVideoJob } from "./scene-video.processor";
import { processVoiceJob } from "./voice.processor";
import { processLipSyncJob } from "./lipsync.processor";
import { processRenderJob } from "./render.processor";
import { processThumbnailJob } from "./thumbnail.processor";
import { processInstagramReplyJob } from "./instagram-reply.processor";
import { processProductionPlanJob } from "./production-plan.processor";

/**
 * Every job type the studio can process in-process.
 *
 * `scene_video_auto` and `browser_task` are deliberately absent: they reach Playwright, so they are
 * registered separately in worker-only-processors.ts and started only where a browser binary
 * exists. See lib/runtime/backgroundJobs.ts.
 */
export const processorRegistry: Partial<Record<JobType, (job: BullJob<BullJobData>) => Promise<unknown>>> = {
  story: processStoryJob,
  character_image: processCharacterImageJob,
  background_image: processBackgroundImageJob,
  scene_image: processSceneImageJob,
  scene_video: processSceneVideoJob,
  voice: processVoiceJob,
  lipsync: processLipSyncJob,
  render: processRenderJob,
  thumbnail: processThumbnailJob,
  instagram_reply: processInstagramReplyJob,
  // The Production Director. An LLM call only — no Playwright, no FFmpeg — so it belongs here.
  production_plan: processProductionPlanJob,
};
