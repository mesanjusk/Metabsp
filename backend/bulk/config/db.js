const mongoose = require('mongoose');

// The bulk module used to open its own second mongoose.connect() call on the
// same default connection that backend/src/config/mongo.js already
// establishes. Two connect() calls against the same singleton just raced/
// re-configured one shared connection anyway, so this is now a no-op that
// asserts the shared connection (opened by src/config/mongo.js before this
// runs) is actually up rather than connecting a second time.
async function connectDB() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error(
      'bulk/config/db.js expects the shared MongoDB connection (src/config/mongo.js) to already be connected'
    );
  }
}

module.exports = connectDB;