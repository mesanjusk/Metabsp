import { headers } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { User } from "@/lib/models";
import { verifyApiToken } from "@/lib/video/modules/api-tokens/service";

/**
 * Who is calling, for every video-studio route.
 *
 * ## What this replaced, and why nothing above it changed
 *
 * In the studio's own repository this resolved a NextAuth session cookie, falling back to a
 * personal API token for non-browser callers like the Claude Code plugin. Metabsp has no NextAuth:
 * a session here is a JWT in `Authorization: Bearer`, issued by `lib/auth/jwt.ts`, held in browser
 * storage and sent by `lib/api/client`.
 *
 * That difference stops at this file. Because the original already read the header through
 * `headers()` rather than taking a `Request` parameter — it was built that way for the plugin's MCP
 * server — the signature is unchanged, and all 78 ported route handlers authenticate against
 * Metabsp sessions without a line of their own changing. The port's largest risk turned out to be
 * a one-file swap.
 *
 * ## Two credential shapes, in this order
 *
 * A Metabsp session token first, because that is what the dashboard sends. Then the studio's own
 * personal API tokens, so the plugin and anything built against them keeps working. Both arrive as
 * Bearer tokens on the same header, so the JWT is tried first and a *parse* failure is not fatal —
 * an opaque API token is not a malformed JWT, it is a different kind of credential.
 *
 * What is deliberately absent: a cookie fallback. Metabsp authenticates every API route from this
 * header, and inventing a second path would mean two answers to "who is calling" in one app.
 */
export async function requireUserId(): Promise<string> {
  const authHeader = (await headers()).get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new UnauthorizedError();

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new UnauthorizedError();

  try {
    const decoded = verifyToken(token) as { id?: string };
    if (decoded?.id) {
      // A well-formed token is not the same as an account that still exists and is still allowed
      // in — the same two checks `lib/auth/session.ts#requireAuth` makes before trusting one.
      const user: any = await User.findById(decoded.id).select("_id isActive").lean();
      if (!user) throw new UnauthorizedError();
      if (user.isActive === false) throw new UnauthorizedError();
      return String(user._id);
    }
  } catch (err) {
    // A deliberate rejection is final. A token that merely failed to parse as a JWT falls through,
    // because an opaque API token reaches this line looking exactly like one.
    if (err instanceof UnauthorizedError) throw err;
  }

  const userId = await verifyApiToken(token);
  if (!userId) throw new UnauthorizedError();
  return userId;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthorizedError";
  }
}
