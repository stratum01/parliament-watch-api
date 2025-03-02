const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  // Key fields from OpenParliament API
  number: { type: String, required: true },
  session: { type: String, required: true },
  introduced: { type: Date },
  name: {
    en: { type: String },
    fr: { type: String }
  },
  legisinfo_id: { type: Number },
  url: { type: String, required: true },
  
  // Additional fields from detailed bill data
  status: { type: String },
  sponsor: { type: String },
  summary: { type: String },
  text_url: { type: String },
  law_url: { type: String },
  events: [
    {
      date: Date,
      text: String,
      institution: String
    }
  ],
  
  // Caching metadata
  data: { type: mongoose.Schema.Types.Mixed }, // Raw API data
  expires: { type: Date, required: true },
  last_updated: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index for faster lookups
billSchema.index({ number: 1, session: 1 }, { unique: true });
billSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Bill', billSchema);