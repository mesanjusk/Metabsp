/**
 * Import-for-side-effects barrel: guarantees every Mongoose model is registered before any
 * `populate()`/`ref` resolution runs, regardless of which module's service function executes first
 * in a given serverless invocation. Import this once at the top of `core/db/mongoose.ts` consumers
 * that use cross-model `populate` (queue processors especially).
 */
import "@/lib/video/modules/accounts/models/GoogleAccount";
import "@/lib/video/modules/settings/models/Settings";
import "@/lib/video/modules/projects/models/Project";
import "@/lib/video/modules/characters/models/Character";
import "@/lib/video/modules/backgrounds/models/Background";
import "@/lib/video/modules/scenes/models/Scene";
import "@/lib/video/modules/jobs/models/Job";
import "@/lib/video/modules/assets/models/Asset";
import "@/lib/video/modules/prompt-templates/models/PromptTemplate";
import "@/lib/video/modules/production-profiles/models/ProductionProfile";
import "@/lib/video/modules/production-runs/models/ProductionRun";
import "@/lib/video/modules/style-packs/models/StylePack";
import "@/lib/video/modules/voice-packs/models/VoicePack";
import "@/lib/video/modules/browser-automation/models/BrowserSession";
import "@/lib/video/modules/browser-automation/models/BrowserTaskRun";
import "@/lib/video/modules/production-plans/models/ProductionPlan";
