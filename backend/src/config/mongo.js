const mongoose = require("mongoose");
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error("MONGO_URI is not set");
    }

    const isProduction = process.env.NODE_ENV === 'production';

    // autoIndex (and Mongo's own implicit collection creation on first write)
    // handles index/collection creation per-model, lazily, as each model is
    // actually used — which is what we want here. We deliberately do NOT call
    // mongoose.connection.syncIndexes() at boot: that eagerly force-creates a
    // real collection for every single registered model across the whole app
    // (~30 models between the two merged products), which on a shared/free
    // Atlas tier can hit the cluster-wide 500-collection cap and crash-loop
    // the server on startup — even for models nothing has written to yet.
    await mongoose.connect(mongoURI, {
      autoIndex: !isProduction,
    });

    logger.info("✅ MongoDB connected");
  } catch (error) {
    logger.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
