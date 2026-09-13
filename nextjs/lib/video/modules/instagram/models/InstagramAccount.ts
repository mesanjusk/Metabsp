import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * A connected Instagram professional account, reachable through its linked Facebook Page (Meta's
 * Instagram Messaging API has no standalone Instagram OAuth — see core/instagram/graph-api.ts).
 * Distinct from `GoogleAccount` (modules/accounts): this is a messaging credential, not a
 * generation-quota pool, and Instagram isn't a Google product — this module is the one deliberate
 * exception to this app's "Google tools only" scope, kept narrow (official Meta API only, no
 * browser automation, no unsolicited outreach — see ARCHITECTURE.md §18).
 *
 * Registered as "VideoInstagramAccount", in `video_instagram_accounts`, and NOT as
 * "InstagramAccount".
 *
 * The platform has carried its own `InstagramAccount` (lib/models/InstagramAccount.ts) since long
 * before the studio was ported, and the two are not the same record: that one keys `userId` as an
 * ObjectId ref and requires `accessTokenEncrypted`; this one keys it as a string and requires a
 * Page id, a Page name and `credentials.pageAccessTokenEnc`. Sharing a model name in Mongoose is
 * not a merge — `models.X ?? model("X", schema)` means whichever module imports first defines the
 * schema for both, and the loser silently gets the other's. Every video route authenticates
 * through lib/auth/session, which pulls in lib/models, so the platform always won: connecting an
 * account here wrote through a schema with no `pageId` and no `credentials`, into the same
 * `instagramaccounts` collection the real Instagram integration reads.
 *
 * The distinct name and the explicit collection are what keep the two apart. Both are load-bearing:
 * Mongoose would otherwise derive `videoinstagramaccounts` from the name, and the name alone is
 * what prevents a future third `InstagramAccount` from doing this again — see
 * tests/modelRegistry.test.ts, which fails the build if any two schemas claim one name.
 */
const instagramAccountSchema = new Schema(
  {
    userId: { type: String, required: true, index: true }, // NextAuth user id (owner, app-side)
    instagramUserId: { type: String, required: true }, // IG-scoped business account id — what webhook events key on
    username: { type: String, required: true },
    name: { type: String },
    profilePictureUrl: { type: String },
    pageId: { type: String, required: true },
    pageName: { type: String, required: true },
    credentials: {
      // AES-256-GCM ciphertext, see core/auth/encryption.ts. Page access tokens derived from a
      // long-lived user token don't expire under normal use, but a Page can be renamed/removed or
      // the grant can be revoked from the user's Facebook side — `status` reflects that, not this.
      pageAccessTokenEnc: { type: String, required: true },
    },
    // Explicit opt-in, default off — connecting the account only makes replying *possible*; a human
    // still has to turn it on, same posture as any other "the app can now act on my behalf" toggle.
    autoReplyEnabled: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "disabled", "token_expired", "error"],
      default: "active",
      index: true,
    },
    lastWebhookAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true },
);

instagramAccountSchema.index({ userId: 1, instagramUserId: 1 }, { unique: true });
// Webhook events carry only the IG business account id (no app userId) — this is the lookup index
// findAccountByInstagramUserId (service.ts) uses, deliberately unscoped by user.
instagramAccountSchema.index({ instagramUserId: 1 });

export type InstagramAccountDoc = InferSchemaType<typeof instagramAccountSchema>;

export const InstagramAccount: Model<InstagramAccountDoc> =
  (models.VideoInstagramAccount as Model<InstagramAccountDoc>) ??
  model<InstagramAccountDoc>("VideoInstagramAccount", instagramAccountSchema, "video_instagram_accounts");
