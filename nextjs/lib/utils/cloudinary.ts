import { v2 as cloudinary } from 'cloudinary';

// Ported unchanged from backend/src/utils/cloudinary.js. Next.js loads
// .env files itself (no dotenv.config() call needed, unlike the Express
// version). Module-level singleton — safe to import from multiple route
// handlers within the same warm invocation/process.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
