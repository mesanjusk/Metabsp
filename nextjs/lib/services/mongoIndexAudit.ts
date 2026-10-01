import mongoose, { type Model } from 'mongoose';
import { connectDB } from '../db/mongo';
import * as CoreModels from '../models';
import '../video/modules/accounts/models/GoogleAccount';
import '../video/modules/api-tokens/models/ApiToken';
import '../video/modules/assets/models/Asset';
import '../video/modules/backgrounds/models/Background';
import '../video/modules/browser-automation/models/BrowserExecutionLog';
import '../video/modules/browser-automation/models/BrowserProviderConfig';
import '../video/modules/browser-automation/models/BrowserSession';
import '../video/modules/browser-automation/models/BrowserTaskRun';
import '../video/modules/characters/models/Character';
import '../video/modules/instagram/models/InstagramAccount';
import '../video/modules/instagram/models/InstagramMessage';
import '../video/modules/jobs/models/Job';
import '../video/modules/production-plans/models/ProductionPlan';
import '../video/modules/production-profiles/models/ProductionProfile';
import '../video/modules/production-runs/models/ProductionRun';
import '../video/modules/projects/models/Project';
import '../video/modules/prompt-templates/models/PromptTemplate';
import '../video/modules/scenes/models/Scene';
import '../video/modules/settings/models/Settings';
import '../video/modules/style-packs/models/StylePack';
import '../video/modules/voice-packs/models/VoicePack';

type IndexKey = Record<string, number | string>;

export type MongoIndexFinding = {
  model: string;
  collection: string;
  collectionExists: boolean;
  expectedCount: number;
  actualCount: number;
  missing: Array<{ key: IndexKey; options: Record<string, unknown> }>;
  extra: Array<{ name: string; key: IndexKey; unique: boolean; sparse: boolean }>;
  dangerous: string[];
};

function stable(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  return '{' + Object.keys(value as Record<string, unknown>).sort()
    .map((key) => JSON.stringify(key) + ':' + stable((value as Record<string, unknown>)[key]))
    .join(',') + '}';
}

export function indexKeySignature(key: Record<string, unknown> = {}): string {
  return Object.entries(key).map(([name, direction]) => name + ':' + String(direction)).join('|');
}

function indexOptionSignature(options: Record<string, unknown> = {}): string {
  return stable({
    unique: Boolean(options.unique),
    sparse: Boolean(options.sparse),
    partialFilterExpression: options.partialFilterExpression || null,
    expireAfterSeconds: options.expireAfterSeconds ?? null,
  });
}

export function sameIndexDefinition(
  expectedKey: Record<string, unknown>,
  expectedOptions: Record<string, unknown>,
  actual: Record<string, any>
): boolean {
  return indexKeySignature(expectedKey) === indexKeySignature(actual.key || {}) &&
    indexOptionSignature(expectedOptions) === indexOptionSignature(actual);
}

function allRegisteredModels(): Model<any>[] {
  void CoreModels;
  return Object.values(mongoose.models)
    .filter((model: any) => model?.db === mongoose.connection)
    .sort((a: any, b: any) => String(a.modelName).localeCompare(String(b.modelName))) as Model<any>[];
}

function detectDangerousIndexes(model: Model<any>, actual: any[]): string[] {
  const findings: string[] = [];

  if (model.modelName === 'Contact') {
    const globalPhoneUnique = actual.find((index) =>
      Boolean(index.unique) && indexKeySignature(index.key || {}) === 'phone:1'
    );
    if (globalPhoneUnique) {
      findings.push(
        'Legacy global unique Contact.phone index "' + String(globalPhoneUnique.name || 'phone_1') +
        '" is present; remove it after confirming the scoped {userId, phone} index exists.'
      );
    }
  }

  return findings;
}

export async function auditMongoIndexes(): Promise<{
  generatedAt: string;
  modelsChecked: number;
  existingCollectionsChecked: number;
  missingIndexCount: number;
  extraIndexCount: number;
  dangerousCount: number;
  findings: MongoIndexFinding[];
}> {
  await connectDB();

  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection is not ready');

  const existingCollections = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((item: any) => item.name)
  );

  const findings: MongoIndexFinding[] = [];

  for (const model of allRegisteredModels()) {
    const collection = model.collection.name;
    const expected = model.schema.indexes().map(([key, options]: any) => ({
      key: key as IndexKey,
      options: (options || {}) as Record<string, unknown>,
    }));
    const collectionExists = existingCollections.has(collection);

    if (!collectionExists) {
      findings.push({
        model: model.modelName,
        collection,
        collectionExists: false,
        expectedCount: expected.length,
        actualCount: 0,
        missing: [],
        extra: [],
        dangerous: [],
      });
      continue;
    }

    const actual = await model.collection.indexes();
    const actualWithoutId = actual.filter((index: any) => index.name !== '_id_');

    const missing = expected.filter((candidate) =>
      !actualWithoutId.some((index: any) => sameIndexDefinition(candidate.key, candidate.options, index))
    );

    const extra = actualWithoutId
      .filter((index: any) =>
        !expected.some((candidate) => sameIndexDefinition(candidate.key, candidate.options, index))
      )
      .map((index: any) => ({
        name: String(index.name || ''),
        key: (index.key || {}) as IndexKey,
        unique: Boolean(index.unique),
        sparse: Boolean(index.sparse),
      }));

    findings.push({
      model: model.modelName,
      collection,
      collectionExists: true,
      expectedCount: expected.length,
      actualCount: actualWithoutId.length,
      missing,
      extra,
      dangerous: detectDangerousIndexes(model, actualWithoutId),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    modelsChecked: findings.length,
    existingCollectionsChecked: findings.filter((item) => item.collectionExists).length,
    missingIndexCount: findings.reduce((sum, item) => sum + item.missing.length, 0),
    extraIndexCount: findings.reduce((sum, item) => sum + item.extra.length, 0),
    dangerousCount: findings.reduce((sum, item) => sum + item.dangerous.length, 0),
    findings,
  };
}

export async function createMissingMongoIndexes() {
  const before = await auditMongoIndexes();
  const createdModels: string[] = [];
  const failures: Array<{ model: string; message: string }> = [];

  for (const finding of before.findings.filter((item) => item.collectionExists && item.missing.length > 0)) {
    const model = mongoose.models[finding.model] as Model<any> | undefined;
    if (!model) continue;
    try {
      await model.createIndexes();
      createdModels.push(finding.model);
    } catch (error: any) {
      failures.push({ model: finding.model, message: error?.message || String(error) });
    }
  }

  const after = await auditMongoIndexes();
  return { before, createdModels, failures, after };
}
