#!/usr/bin/env node
/**
 * Idempotent seed for the default subscription plans. There is no admin UI to
 * create SubscriptionPlan documents, so a fresh deployment needs this before
 * the billing panel has anything to show.
 *
 * Usage: MONGO_URI=... node scripts/seed-billing-plans.mjs
 */
import mongoose from 'mongoose';

const DEFAULT_PLANS = [
  {
    code: 'starter',
    name: 'Starter',
    description: 'For small teams sending under 1,000 messages a month.',
    priceInPaise: 99900,
    billingInterval: 'monthly',
    includedMessages: 1000,
    overagePricePerMessageInPaise: 20,
  },
  {
    code: 'growth',
    name: 'Growth',
    description: 'For teams running regular campaigns and broadcasts.',
    priceInPaise: 299900,
    billingInterval: 'monthly',
    includedMessages: 5000,
    overagePricePerMessageInPaise: 15,
  },
];

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error('MONGO_URI must be set');
  process.exit(1);
}

await mongoose.connect(mongoUri);

// Written against the raw collection rather than the app's Mongoose model:
// the model is TypeScript compiled by Next, which a standalone node script
// cannot import.
const collection = mongoose.connection.db.collection('subscriptionplans');
for (const plan of DEFAULT_PLANS) {
  await collection.updateOne(
    { code: plan.code },
    { $set: { ...plan, isActive: true, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  console.log(`[seed-billing-plans] Upserted plan: ${plan.code}`);
}

await mongoose.disconnect();
