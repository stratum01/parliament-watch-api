const express = require('express');
const router = express.Router();
const Vote = require('../models/Vote');
const { fetchFromAPI, getCacheExpiration } = require('../services/proxy');

/**
 * GET /api/votes
 * Retrieve a list of votes with pagination and filtering
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0, session } = req.query;
    
    // Build cache key
    const cacheKey = `votes-${session || 'all'}-${limit}-${offset}`;
    
    // Check database first
    let votesData = await Vote.findOne({ 
      url: cacheKey,
      expires: { $gt: new Date() }
    });
    
    // If not in database or expired, fetch from API
    if (!votesData) {
      const params = { limit, offset, session };
      const apiData = await fetchFromAPI('/votes/', params);
      
      // Store in database
      votesData = new Vote({
        number: parseInt(offset), // Using offset as a unique identifier for list
        session: session || 'all',
        date: new Date(),
        url: cacheKey,
        data: apiData,
        expires: getCacheExpiration('/votes/')
      });
      
      await votesData.save();
    }
    
    // Return data
    res.json(votesData.data);
  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/votes/:voteUrl
 * Retrieve details for a specific vote
 */
router.get('/:session/:voteNumber', async (req, res) => {
  try {
    const { session, voteNumber } = req.params;
    const voteUrl = `/votes/${session}/${voteNumber}/`;
    
    // Check database first
    let voteData = await Vote.findOne({ 
      number: parseInt(voteNumber),
      session,
      expires: { $gt: new Date() }
    });
    
    // If not in database or expired, fetch from API
    if (!voteData) {
      const apiData = await fetchFromAPI(voteUrl);
      
      // Store in database
      voteData = new Vote({
        number: parseInt(voteNumber),
        session,
        date: new Date(apiData.date),
        result: apiData.result,
        yea_total: apiData.yea_total,
        nay_total: apiData.nay_total,
        paired_total: apiData.paired_total,
        description: apiData.description,
        url: voteUrl,
        bill_url: apiData.bill_url,
        bill_number: apiData.bill_number,
        party_votes: apiData.party_votes,
        members_votes: apiData.party_vote_details,
        data: apiData,
        expires: getCacheExpiration(voteUrl)
      });
      
      await voteData.save();
    }
    
    // Return data
    res.json(voteData.data);
  } catch (error) {
    console.error('Error fetching vote details:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;