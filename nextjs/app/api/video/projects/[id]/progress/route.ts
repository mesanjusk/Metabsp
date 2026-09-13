import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/video/core/auth/session";
import { connectToDatabase } from "@/lib/video/core/db/mongoose";
import { Project } from "@/lib/video/modules/projects/models/Project";
import { Scene } from "@/lib/video/modules/scenes/models/Scene";
import { Job } from "@/lib/video/modules/jobs/models/Job";
import { Asset } from "@/lib/video/modules/assets/models/Asset";
import { findAccountWithFlowSession } from "@/lib/video/modules/accounts/service";
import { isExtensionConnected } from "@/lib/video/core/browser/extension-presence";
import { computeProgress } from "@/lib/video/core/production/progress";
import { checkStalled, describeStall } from "@/lib/video/modules/jobs/stall";
import { explainJobFailure } from "@/lib/video/core/ai/explain-failure";

export const dynamic = "force-dynamic";

/**
 * Everything the one-screen studio view polls, in a single request.
 *
 * Deliberately one endpoint rather than the four it replaces (project, scenes, jobs, accounts): the
 * page it feeds polls every few seconds for as long as a video takes to make, and four round trips
 * on that loop is four times the load for a screen that shows one number and one sentence.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await connectToDatabase();

    const project = await Project.findOne({ _id: id, userId })
      .select("title status completionPercent finalVideoAssetId thumbnailAssetId storyJson.title")
      .lean();
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [scenes, jobs, flowAccount, extensionConnected] = await Promise.all([
      Scene.find({ userId, projectId: id }).select("status").lean(),
      Job.find({ userId, projectId: id }).select("status type error updatedAt").lean(),
      // Cheap and cached upstream; this is what turns "waiting" into the one actionable setup step.
      findAccountWithFlowSession(userId).catch(() => null),
      // The other way a clip can get made, and on this deployment the only one. A stored Flow
      // session belongs to a Playwright runner on a worker host; there is no worker host here, so
      // asking only that question reported "Connect Google Flow" at a user whose extension was
      // connected and working. Either answer means a clip can be produced.
      isExtensionConnected().catch(() => false),
    ]);

    // A step nothing is processing any more is a stop, not progress. Without this the page reports
    // "making…" forever on a pipeline that died, and offers nothing to press — which is exactly what
    // a stranded job looked like from this screen. It only counts as stopped when *nothing* else is
    // still moving: one stalled job among nine live ones is the queue's problem, not the viewer's.
    const stalls = jobs.map((job) => ({ job, report: checkStalled(job) }));
    const stalledJobs = stalls.filter(({ report }) => report.stalled);
    const stillMoving = stalls.filter(
      ({ job, report }) => !report.stalled && ["queued", "running", "retrying"].includes(job.status ?? ""),
    );
    const stopped = stalledJobs.length > 0 && stillMoving.length === 0 ? stalledJobs[0] : undefined;

    const progress = computeProgress({
      projectStatus: project.status ?? "draft",
      hasFinalVideo: !!project.finalVideoAssetId,
      sceneStatuses: scenes.map((s) => s.status ?? "pending"),
      jobStatuses: jobs.map((j) => j.status),
      canMakeVideo: !!flowAccount || extensionConnected,
      stalled: !!stopped,
    });

    // Only loaded once there is something to play — the studio view shows the player and the
    // download button from these, and neither exists before the render finishes.
    const [video, thumbnail] = await Promise.all([
      project.finalVideoAssetId ? Asset.findOne({ _id: project.finalVideoAssetId, userId }).select("url").lean() : null,
      project.thumbnailAssetId ? Asset.findOne({ _id: project.thumbnailAssetId, userId }).select("url").lean() : null,
    ]);

    const failedJob = jobs.find((j) => j.status === "failed");

    return NextResponse.json({
      title: project.storyJson?.title || project.title,
      // Whether this project has ever been started, which is not a question `progress` can answer.
      // `computeProgress` maps a draft project to phase "writing" with busy: true — reasonable for a
      // project whose story job is in flight, and indistinguishable from one nobody has pressed
      // start on, since neither has scenes and both are status "draft". A page that branches on
      // `busy` therefore renders "Writing the story, 5%" over a project with no jobs at all, and
      // hides the one button that would create one. The job rows are already loaded here and say it
      // outright.
      started: jobs.length > 0,
      progress: {
        ...progress,
        // Mounted under /services/video here, not at the studio's own root. Left unchanged these
        // were two dead links on the one screen whose whole job is telling someone what to do next.
        //
        // "Connect an account" now lands on the screen that can actually connect one. It pointed at
        // the project list, which is a page with no way to add an account on it — so the one button
        // the studio offers when a clip cannot be made automatically sent people somewhere that
        // could not help them.
        href: progress.action?.target === "accounts" ? "/services/video/accounts" : `/services/video/${id}`,
      },
      videoUrl: video?.url ?? null,
      thumbnailUrl: thumbnail?.url ?? null,
      // The first failure's own message and id, so "something went wrong" can be both explained
      // and acted on here, rather than sending someone to a history page to find out what broke and
      // giving them nothing to do about it when they get there.
      // Translated, not passed through: Job.error holds the provider's raw SDK text, which is right
      // to store and wrong to show. See explainJobFailure.
      failure: explainJobFailure(failedJob?.error) ?? (stopped ? describeStall(stopped.job, stopped.report) : null) ?? null,
      // Both are re-runnable, and retryJob accepts either (modules/jobs/service.ts).
      failedJobId: (failedJob ?? stopped?.job)?._id.toString() ?? null,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed to load progress" }, { status: 500 });
  }
}
