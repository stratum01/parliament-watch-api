const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  // Key fields from OpenParliament API
  number: { type: Number, required: true },
  session: { type: String, required: true },
  date: { type: Date, required: true },
  result: { type: String },
  yea_total: { type: Number },
  nay_total: { type: Number },
  paired_total: { type: Number },
  description: {
    en: { type: String },
    fr: { type: String }
  },
  url: { type: String, required: true },
  bill_url: { type: String },
  
  // Additional fields from detailed vote data
  bill_number: { type: String },
  party_votes: { type: mongoose.Schema.Types.Mixed },
  members_votes: [
    {
      name: String,
      politician_url: String,
      vote: String,
      party: String
    }
  ],
  
  // Caching metadata
  data: { type: mongoose.Schema.Types.Mixed }, // Raw API data
  expires: { type: Date, required: true },
  last_updated: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index for faster lookups
voteSchema.index({ number: 1, session: 1 }, { unique: true });
voteSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });
voteSchema.index({ date: -1 }); // For sorting by most recent

module.exports = mongoose.model('Vote', voteSchema);