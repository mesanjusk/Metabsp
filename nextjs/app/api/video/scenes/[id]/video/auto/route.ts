import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/video/core/auth/session";
import { getScene } from "@/lib/video/modules/scenes/service";
import { enqueueJob } from "@/lib/video/modules/jobs/service";
import { findAccountWithFlowSession } from "@/lib/video/modules/accounts/service";
import { isExtensionConnected } from "@/lib/video/core/browser/extension-presence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Enqueues automated Google Flow video generation.
 *
 * Prefer the local Chrome runner when it is connected: it uses the operator's existing Google login
 * and keeps browser/Flow work off the cloud server. A stored Playwright Flow session remains a
 * fallback so existing cloud-worker installations keep working unchanged.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: sceneId } = await params;
    const scene = await getScene(userId, sceneId);
    if (!scene) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [localRunnerOnline, account] = await Promise.all([
      isExtensionConnected().catch(() => false),
      findAccountWithFlowSession(userId).catch(() => null),
    ]);
    if (!localRunnerOnline && !account) {
      return NextResponse.json(
        {
          error:
            "Start the Video Local Runner in Chrome (recommended), or connect a Google account's Flow browser session on the Accounts page.",
        },
        { status: 400 },
      );
    }

    const job = await enqueueJob({
      userId,
      projectId: scene.projectId.toString(),
      sceneId,
      type: "scene_video_auto",
      payload: { preferLocalRunner: localRunnerOnline },
    });

    return NextResponse.json({ job, execution: localRunnerOnline ? "local_chrome" : "cloud_playwright" }, { status: 202 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed to start automated video generation" }, { status: 500 });
  }
}
