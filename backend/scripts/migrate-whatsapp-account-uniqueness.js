// One-off migration for the WhatsAppAccount.phoneNumberId global uniqueness
// fix (see repositories/whatsappAccount.js). Safe to re-run.
//
// Production disables autoIndex (see src/config/mongo.js) so this new
// partial unique index is never created automatically at boot — run this
// script by hand instead:
//
//   MONGO_URI="..." node backend/scripts/migrate-whatsapp-account-uniqueness.js
//
// What it does:
//   1. Backfills the `numberClaimed` field on any account that predates it.
//   2. Checks for phoneNumberId collisions across different users among
//      currently-claimed accounts. If any exist, it prints them and exits
//      WITHOUT building the index — resolve those manually first (decide
//      which user actually owns the number, disconnect the other) or the
//      index build will fail anyway.
//   3. Builds the partial unique index once the data is clean.
const mongoose = require('mongoose');
const WhatsAppAccount = require('../src/repositories/whatsappAccount');

const MONGO_URI = process.env.MONGO_URI;

(async () => {
  try {
    if (!MONGO_URI) throw new Error('MONGO_URI is not set');
    await mongoose.connect(MONGO_URI, {});

    const backfill = await WhatsAppAccount.collection.updateMany(
      { numberClaimed: { $exists: false } },
      [{ $set: { numberClaimed: { $ne: ['$status', 'disconnected'] } } }]
    );
    console.log(`Backfilled numberClaimed on ${backfill.modifiedCount} account(s).`);

    const duplicates = await WhatsAppAccount.aggregate([
      { $match: { numberClaimed: true } },
      { $group: { _id: '$phoneNumberId', count: { $sum: 1 }, accounts: { $push: { id: '$_id', userId: '$userId', status: '$status', updatedAt: '$updatedAt' } } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    if (duplicates.length) {
      console.error(`Found ${duplicates.length} phoneNumberId(s) claimed by more than one account. Resolve these before the unique index can be built:`);
      console.error(JSON.stringify(duplicates, null, 2));
      console.error('Not building the index. Disconnect/reassign the conflicting accounts, then re-run this script.');
      process.exit(1);
    }

    await WhatsAppAccount.collection.createIndex(
      { phoneNumberId: 1 },
      { unique: true, partialFilterExpression: { numberClaimed: true }, name: 'phoneNumberId_1_numberClaimed_unique' }
    );
    console.log('✅ Unique index on phoneNumberId (partial: numberClaimed=true) created.');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
})();
