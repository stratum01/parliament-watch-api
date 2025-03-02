const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  // Key fields from OpenParliament API
  name: { type: String, required: true },
  url: { type: String, required: true, unique: true },
  party: { type: String },
  constituency: { type: String },
  province: { type: String },
  photo_url: { type: String },
  
  // Additional fields from detailed member data
  email: { type: String },
  phone: { type: String },
  roles: [String],
  offices: [
    {
      postal: String,
      tel: String,
      fax: String,
      type: String
    }
  ],
  
  // Caching metadata
  data: { type: mongoose.Schema.Types.Mixed }, // Raw API data
  expires: { type: Date, required: true },
  last_updated: { type: Date, default: Date.now }
}, { timestamps: true });

memberSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });
memberSchema.index({ name: 'text' }); // For text search

module.exports = mongoose.model('Member', memberSchema);