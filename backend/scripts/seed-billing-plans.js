// One-time/idempotent seed for default subscription plans — there is no
// admin UI to create SubscriptionPlan docs yet, so a fresh deployment needs
// this to have anything to show on the billing panel.
require('dotenv').config();
const mongoose = require('mongoose');
const SubscriptionPlan = require('../src/models/SubscriptionPlan');
const logger = require('../src/utils/logger');

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

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const plan of DEFAULT_PLANS) {
    await SubscriptionPlan.findOneAndUpdate({ code: plan.code }, plan, { upsert: true, new: true });
    logger.info(`[seed-billing-plans] Upserted plan: ${plan.code}`);
  }

  await mongoose.disconnect();
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('[seed-billing-plans] Failed:', error.message);
    process.exit(1);
  });
