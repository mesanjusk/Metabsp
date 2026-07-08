// cloudinary.v2 is a process-wide singleton, so re-use the single
// configuration in backend/utils/cloudinary.js instead of calling
// cloudinary.config() a second time with the same values.
module.exports = require('../../utils/cloudinary');
