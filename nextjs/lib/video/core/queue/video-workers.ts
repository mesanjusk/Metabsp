import { Worker } from "bullmq";
import { getRedisConnection } from "./connection";
import { processorRegistry } from "./processors";
import { sweepAbandonedMissions } from "./worker-runtime";
import { reactivateExpiredQuotas } from "@/lib/video/modules/accounts/selector";
import { connectToDatabase } from "@/lib/video/core/db/mongoose";

/**
 * The Video Studio's queue consumers, running inside this app's own process.
 *
 * Without this the studio was a producer with no consumer. Every route that enqueues work — writing
 * the story, drawing a scene, cutting the final video — returned 202 and wrote a Job row, and then
 * nothing on earth picked it up. From the studio screen that is indistinguishable from slowness:
 * the progress endpoint reports "writing…", `busy: true`, and polls forever on a pipeline that was
 * never going to move. `lib/runtime/backgroundJobs.ts` says it best about the WhatsApp queues — "a
 * queue with a producer and no consumer is the failure mode this whole module exists to prevent" —
 * and the studio's queues were simply never added to it.
 *
 * ## Why the registry, and not all of it
 *
 * The studio ships two registries. `processorRegistry` is the portable set: an LLM call, an HTTP
 * fetch, an ffmpeg invocation. `workerOnlyProcessorRegistry` is the three job types that reach
 * Playwright, and those stay out of this process deliberately — there is no Chromium on this
 * instance, and a job that needs one would fail on every attempt rather than wait for a host that
 * can serve it.
 *
 * Leaving them unregistered is not a loss of function here, because this deployment does not use
 * them: clips come back through the Chrome extension on an operator's desktop
 * (`scene_video` → `tryExtensionVideo`), which needs no server-side browser at all. A
 * `scene_video_auto` job enqueued against this process stays queued and visible rather than failing
 * — the honest degrade `worker-only-processors.ts` describes.
 *
 * ## Why in-process rather than a second service
 *
 * The studio's own `worker.ts` is a standalone process, which is right when you can pay for one.
 * This deployment is a single free instance, and Next's `instrumentation.ts` already boots
 * long-lived work here for the WhatsApp and webhook queues. Adding a third set of consumers to a
 * process that is already always-on costs nothing extra and removes the deployment that never
 * existed — which is why video could never run here in the first place.
 */

/** Matches the standalone worker's default, and stays low because the instance is small. */
const CONCURRENCY = Number(process.env.VIDEO_WORKER_CONCURRENCY ?? 2);

/**
 * How often to sweep for abandoned extension missions and expired account quotas.
 *
 * The standalone worker does this on its scheduler tick; the serverless route does it on every
 * invocation. Neither runs here, so it gets its own timer. Five minutes is well inside the
 * ten-minute heartbeat grace a mission gets before it is called dead.
 */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

let workers: Worker[] = [];
let sweepTimer: ReturnType<typeof setInterval> | null = null;

export function startVideoWorkers(): void {
  if (workers.length > 0) return;

  const connection = getRedisConnection();
  const entries = Object.entries(processorRegistry) as Array<
    [string, NonNullable<(typeof processorRegistry)[keyof typeof processorRegistry]>]
  >;

  // Every processor opens with its own `connectToDatabase()`, but that is a per-job await on a
  // connection this process should already hold. Warming it once at boot keeps the first job of the
  // day from paying for it.
  connectToDatabase().catch((err) => console.error("[video-queue] initial DB connect failed:", err));

  workers = entries.map(([type, processor]) => {
    const worker = new Worker(type, processor, { connection, concurrency: CONCURRENCY });
    worker.on("failed", (job, err) =>
      console.error(`[video-queue] ${type} job ${job?.id} (mongo ${job?.data?.jobId}) failed:`, err?.message),
    );
    // Deliberately not logging every completion: eleven queues on a shared log is noise, and a
    // finished job is already visible in the job history the studio renders.
    worker.on("error", (err) => console.error(`[video-queue] ${type} worker error:`, err?.message));
    return worker;
  });

  const sweep = () => {
    sweepAbandonedMissions().catch((err) => console.error("[video-queue] mission sweep failed:", err));
    reactivateExpiredQuotas().catch((err) => console.error("[video-queue] quota sweep failed:", err));
  };
  sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
  // `unref` so this timer alone never holds the process open during a shutdown.
  sweepTimer.unref?.();

  console.log(`[video-queue] consuming ${entries.length} queues: ${entries.map(([t]) => t).join(", ")}`);
}

/** Lets in-flight jobs finish rather than abandoning one mid-step. Used by the shutdown path. */
export async function stopVideoWorkers(): Promise<void> {
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = null;
  const closing = workers;
  workers = [];
  await Promise.allSettled(closing.map((w) => w.close()));
}
