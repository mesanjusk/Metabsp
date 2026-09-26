import type { Job as BullJob } from "bullmq";
import { withJobLifecycle, type BullJobData, type ProcessorResult } from "./helpers";
import { Project } from "@/lib/video/modules/projects/models/Project";
import { Scene } from "@/lib/video/modules/scenes/models/Scene";
import { Character } from "@/lib/video/modules/characters/models/Character";
import { findAccountWithFlowSession, getDecryptedFlowSessionState } from "@/lib/video/modules/accounts/service";
import { resolveActiveTemplate } from "@/lib/video/modules/prompt-templates/service";
import { generateVideoViaFlowAutomation } from "@/lib/video/core/ai/providers/google/google-flow-automated";
import { completeSceneVideo, fallBackToManualVideo } from "./scene-video.processor";
import { isExtensionConnected } from "@/lib/video/core/browser/extension-presence";
import { resolveFlowVideo } from "@/lib/video/core/production/flow-image-step";
import { renderTemplate } from "@/lib/video/core/prompt-engine/engine";
import { sceneVideoTemplate } from "@/lib/video/core/prompt-engine/templates";

/**
 * Automated Google Flow scene video generation.
 *
 * When the local Chrome runner is online, Flow is driven on the office PC using that Chrome
 * profile's existing Google login. That avoids Chromium/Flow load on the cloud worker. If no local
 * runner is connected, the existing stored-session Playwright path remains the fallback.
 */
export async function processSceneVideoAutoJob(bullJob: BullJob<BullJobData>): Promise<ProcessorResult> {
  return withJobLifecycle(bullJob, async (jobDoc) => {
    if (!jobDoc.sceneId) throw new Error("Job is missing sceneId");
    const [scene, project] = await Promise.all([
      Scene.findOne({ _id: jobDoc.sceneId, userId: jobDoc.userId }),
      Project.findOne({ _id: jobDoc.projectId, userId: jobDoc.userId }),
    ]);
    if (!scene) throw new Error("Scene not found");
    if (!project) throw new Error("Project not found");

    const characters = await Character.find({ _id: { $in: scene.characterIds }, userId: jobDoc.userId }).lean();
    const characterReferenceImages = characters
      .map((c) => {
        const front = c.sheetAssets?.find((s) => s.pose === "front-view");
        return front ? { url: (front.assetId as unknown as { url: string })?.url, description: c.name } : null;
      })
      .filter((r): r is { url: string; description: string } => !!r?.url);

    const style = project.style === "Custom" ? (project.customStyleDescription ?? "Custom") : project.style;
    const promptTemplateOverrides = project.promptTemplateOverrides as Record<string, string> | undefined;
    const templateOverride = await resolveActiveTemplate(jobDoc.userId, "scene_video", promptTemplateOverrides?.scene_video);
    const durationSeconds = 8;
    const promptText = renderTemplate(templateOverride ?? sceneVideoTemplate, {
      action: scene.visual,
      camera: scene.camera,
      lighting: "morning",
      emotion: scene.emotion,
      durationSeconds: String(durationSeconds),
      style,
    });

    // Once a job has extension run ids, keep resolving those runs even if the browser briefly goes
    // offline after completing them. Otherwise a resumed job could abandon a finished local clip
    // and unexpectedly switch to Playwright.
    const existingFlowRunIds = (jobDoc.payload as { flowRunIds?: Record<string, string> } | undefined)?.flowRunIds;
    const localRunnerOnline = await isExtensionConnected().catch(() => false);
    const useLocalRunner = Boolean(existingFlowRunIds?.video) || localRunnerOnline;

    if (useLocalRunner) {
      const result = await resolveFlowVideo(
        jobDoc,
        {
          key: "video",
          prompt: promptText,
          referenceUrls: characterReferenceImages.map((image) => image.url),
        },
        {
          projectId: jobDoc.projectId?.toString(),
          imageTarget: { kind: "scene-video", sceneId: scene._id.toString() },
        },
      );
      return completeSceneVideo(scene, jobDoc.userId, jobDoc.projectId!.toString(), result, project.activeProfileId);
    }

    const account = await findAccountWithFlowSession(jobDoc.userId);
    if (!account) {
      throw new Error("Video Local Runner is offline and no Google account has a connected Flow browser session");
    }
    const storageStateJson = await getDecryptedFlowSessionState(jobDoc.userId, account.accountId);
    if (!storageStateJson) throw new Error("Flow session for the selected account could not be decrypted");
    jobDoc.set("googleAccountId", account.accountId);
    await jobDoc.save();

    const result = await generateVideoViaFlowAutomation(
      {
        sceneId: scene._id.toString(),
        characterReferenceImages,
        action: scene.visual,
        camera: scene.camera,
        lighting: "morning",
        emotion: scene.emotion,
        durationSeconds,
        style,
        templateOverride,
      },
      storageStateJson,
    );

    if (result.status === "manual_pending") {
      await fallBackToManualVideo(scene, result);
      return {
        status: "manual_pending",
        taskId: result.taskId,
        promptText: result.promptText,
        instructions: result.instructions,
        characterReferenceImages,
      };
    }

    return completeSceneVideo(scene, jobDoc.userId, jobDoc.projectId!.toString(), result, project.activeProfileId);
  });
}
