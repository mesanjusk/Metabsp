import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Tenancy is the property that has to hold across the whole merge, not in one place.
 *
 * Project B's models carried `createdBy` for attribution but nothing filtered on it — it was
 * effectively single-tenant. Every collection in this application is scoped by `userId`. Porting a
 * model without that field would let any user read another user's credentials, browser sessions and
 * workflow runs, which was the highest-severity risk in the merge.
 *
 * A code review catches that once. This catches it every time someone adds a model.
 */
/**
 * Resolved from this file rather than from the working directory.
 *
 * These were paths under `src/` until the studio was ported into Metabsp, where the same modules
 * live under `lib/video/`. The guard below — "finds the models it is supposed to be checking" — is
 * what turned that move into four failing tests instead of a security check quietly passing over an
 * empty list, which is exactly what it was written for. Anchoring to the file means the next move
 * does not need to remember this file at all.
 */
const MODULES_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Every `models/` directory under lib/video/modules, discovered rather than listed.
 *
 * The list used to be hand-written, which made the guard exactly as good as whoever last edited it:
 * a module added without touching this file was simply never checked. Discovery means a new
 * module is covered the day it lands, and a module that is deleted stops being a stale entry.
 */
function modelDirs(): string[] {
  return readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(MODULES_DIR, entry.name, "models"))
    .filter((dir) => existsSync(dir));
}

function modelFiles(): { file: string; source: string }[] {
  return modelDirs().flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => ({ file: path.join(dir, name), source: readFileSync(path.join(dir, name), "utf8") })),
  );
}

describe("every collection is tenant-scoped", () => {
  it("finds the models it is supposed to be checking", () => {
    // Guards against the check silently passing because a directory moved.
    expect(modelDirs().length).toBeGreaterThanOrEqual(5);
    expect(modelFiles().length).toBeGreaterThanOrEqual(15);
  });

  it("declares userId as required and indexed on every collection", () => {
    for (const { file, source } of modelFiles()) {
      for (const { schemaVar, modelName } of registeredSchemas(source)) {
        const body = schemaBody(source, schemaVar);
        expect(body, `${file}: model("${modelName}") names ${schemaVar}, which is not declared here`).not.toBeNull();
        const userId = /userId:\s*\{([^}]*)\}/.exec(body ?? "")?.[1] ?? "";
        expect(
          userId,
          `${file}: collection "${modelName}" (${schemaVar}) declares no userId — every document in this app is scoped to one`,
        ).not.toBe("");
        expect(userId, `${file}: "${modelName}".userId is not required`).toMatch(/required:\s*true/);
        // `unique: true` builds an index of its own, so either spelling satisfies "is indexed" —
        // Settings uses it because a user has exactly one row.
        expect(userId, `${file}: "${modelName}".userId is not indexed, so every lookup by it is a collection scan`).toMatch(
          /(?:index|unique):\s*true/,
        );
      }
    }
  });

  it("does not carry Project B's createdBy, which nothing ever filtered on", () => {
    for (const { file, source } of modelFiles()) {
      // Comments are stripped first: several of these files legitimately explain in prose why
      // createdBy was replaced, and matching that would be a false positive.
      expect(stripComments(source), `${file} still declares createdBy`).not.toMatch(/createdBy/);
    }
  });
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * The schemas that actually become collections, and nothing else.
 *
 * The check used to compare `new Schema(` count against `userId` count, which treated an embedded
 * sub-document as a collection: Character declares three schemas and stores one: the other two are
 * a spec and a sheet asset living inside the character document, where a userId would be noise.
 * That heuristic could only be kept honest by never embedding anything.
 *
 * Reading the `model("Name", xSchema)` registrations instead asks the question that matters —
 * "can a query reach this without naming a user?" — and only about the schemas where it can.
 */
function registeredSchemas(source: string): { modelName: string; schemaVar: string }[] {
  // Comments are stripped first: these files explain the registration idiom in prose, and a
  // `model("X", schema)` inside a doc comment is not a collection.
  const registration = /\bmodel(?:<[^>]*>)?\(\s*["'`]([A-Za-z0-9_]+)["'`]\s*,\s*([A-Za-z0-9_]+)\s*[,)]/g;
  return [...stripComments(source).matchAll(registration)].map((match) => ({
    modelName: match[1],
    schemaVar: match[2],
  }));
}

/** The source text of one `const xSchema = new Schema({ ... })`, up to the matching close. */
function schemaBody(source: string, schemaVar: string): string | null {
  const declaration = new RegExp(`\\b${schemaVar}\\s*=\\s*new Schema(?:<[^>]*>)?\\(`).exec(stripComments(source));
  if (!declaration) return null;

  const body = stripComments(source);
  let depth = 0;
  for (let i = declaration.index + declaration[0].length - 1; i < body.length; i += 1) {
    if (body[i] === "(") depth += 1;
    else if (body[i] === ")") {
      depth -= 1;
      if (depth === 0) return body.slice(declaration.index, i + 1);
    }
  }
  return null;
}

describe("secret-bearing fields are not loaded by default", () => {
  const SECRET_FIELDS = ["valueEnc", "secretEnc", "storageStateEnc"];

  it("marks every encrypted field select: false", () => {
    for (const { file, source } of modelFiles()) {
      for (const field of SECRET_FIELDS) {
        // Match the field declaration and confirm select:false appears before its closing brace —
        // without it a careless .lean() or res.json(doc) can serialise the ciphertext.
        const declaration = source.match(new RegExp(`${field}:\\s*\\{[^}]*\\}`));
        if (!declaration) continue;
        expect(declaration[0], `${file}: ${field} is not select:false`).toMatch(/select:\s*false/);
      }
    }
  });
});
