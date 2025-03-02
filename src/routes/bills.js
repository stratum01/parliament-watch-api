const express = require('express');
const router = express.Router();
const Bill = require('../models/Bill');
const { fetchFromAPI, getCacheExpiration } = require('../services/proxy');

/**
 * GET /api/bills
 * Retrieve a list of bills with pagination and filtering
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0, session } = req.query;
    
    // Build cache key
    const cacheKey = `bills-${session || 'all'}-${limit}-${offset}`;
    
    // Check database first
    let billsData = await Bill.findOne({ 
      url: cacheKey,
      expires: { $gt: new Date() }
    });
    
    // If not in database or expired, fetch from API
    if (!billsData) {
      const params = { limit, offset, session };
      const apiData = await fetchFromAPI('/bills/', params);
      
      // Store in database
      billsData = new Bill({
        number: cacheKey,
        session: session || 'all',
        url: cacheKey,
        data: apiData,
        expires: getCacheExpiration('/bills/')
      });
      
      await billsData.save();
    }
    
    // Return data
    res.json(billsData.data);
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bills/:billUrl
 * Retrieve details for a specific bill
 */
router.get('/:session/:billNumber', async (req, res) => {
  try {
    const { session, billNumber } = req.params;
    const billUrl = `/bills/${session}/${billNumber}/`;
    
    // Check database first
    let billData = await Bill.findOne({ 
      url: billUrl,
      expires: { $gt: new Date() }
    });
    
    // If not in database or expired, fetch from API
    if (!billData) {
      const apiData = await fetchFromAPI(billUrl);
      
      // Extract key data for schema
      const {
        number,
        name,
        introduced,
        legisinfo_id,
        status,
        sponsor_politician_url,
        law_url,
        text_url,
        summary_html
      } = apiData;
      
      // Store in database
      billData = new Bill({
        number,
        session,
        url: billUrl,
        introduced: new Date(introduced),
        name,
        legisinfo_id,
        status,
        sponsor: sponsor_politician_url,
        text_url,
        law_url,
        summary: summary_html,
        data: apiData,
        expires: getCacheExpiration(billUrl)
      });
      
      await billData.save();
    }
    
    // Return data
    res.json(billData.data);
  } catch (error) {
    console.error('Error fetching bill details:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
