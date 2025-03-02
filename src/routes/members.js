const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const { fetchFromAPI, getCacheExpiration } = require('../services/proxy');

/**
 * GET /api/members
 * Retrieve a list of members with pagination and filtering
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0, province, party, search } = req.query;
    
    // Build cache key (without search since that would create too many variations)
    const cacheKey = `members-${province || 'all'}-${party || 'all'}-${limit}-${offset}`;
    
    // Check if search was provided (skip cache for search queries)
    let membersData = null;
    if (!search) {
      // Check database first
      membersData = await Member.findOne({ 
        url: cacheKey,
        expires: { $gt: new Date() }
      });
    }
    
    // If not in database or expired, fetch from API
    if (!membersData) {
      const params = { limit, offset, province, party };
      const apiData = await fetchFromAPI('/politicians/', params);
      
      // Store in database (only if not a search query)
      if (!search) {
        membersData = new Member({
          name: cacheKey,
          url: cacheKey,
          data: apiData,
          expires: getCacheExpiration('/politicians/')
        });
        
        await membersData.save();
      } else {
        membersData = { data: apiData };
      }
    }
    
    // Handle search locally if provided
    if (search && membersData.data.objects) {
      const searchLower = search.toLowerCase();
      membersData.data.objects = membersData.data.objects.filter(member => 
        member.name.toLowerCase().includes(searchLower) || 
        (member.constituency && member.constituency.toLowerCase().includes(searchLower))
      );
    }
    
    // Return data
    res.json(membersData.data);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/members/:memberUrl
 * Retrieve details for a specific member
 */
router.get('/:memberName', async (req, res) => {
  try {
    const { memberName } = req.params;
    const memberUrl = `/politicians/${memberName}/`;
    
    // Check database first
    let memberData = await Member.findOne({ 
      url: memberUrl,
      expires: { $gt: new Date() }
    });
    
    // If not in database or expired, fetch from API
    if (!memberData) {
      const apiData = await fetchFromAPI(memberUrl);
      
      // Store in database
      memberData = new Member({
        name: apiData.name || memberName,
        url: memberUrl,
        party: apiData.party,
        constituency: apiData.constituency,
        province: apiData.province,
        photo_url: apiData.image,
        email: apiData.email,
        phone: apiData.phone,
        roles: apiData.roles,
        offices: apiData.offices,
        data: apiData,
        expires: getCacheExpiration(memberUrl)
      });
      
      await memberData.save();
    }
    
    // Return data
    res.json(memberData.data);
  } catch (error) {
    console.error('Error fetching member details:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/members/:memberUrl/votes
 * Retrieve voting history for a specific member
 */
router.get('/:memberName/votes', async (req, res) => {
  try {
    const { memberName } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const memberVotesUrl = `/politicians/${memberName}/votes/`;
    
    // Build cache key
    const cacheKey = `${memberVotesUrl}-${limit}-${offset}`;
    
    // Check database first
    let memberVotesData = await Member.findOne({ 
      url: cacheKey,
      expires: { $gt: new Date() }
    });
    
    // If not in database or expired, fetch from API
    if (!memberVotesData) {
      const params = { limit, offset };
      const apiData = await fetchFromAPI(memberVotesUrl, params);
      
      // Store in database
      memberVotesData = new Member({
        name: `${memberName}-votes`,
        url: cacheKey,
        data: apiData,
        expires: getCacheExpiration(memberVotesUrl)
      });
      
      await memberVotesData.save();
    }
    
    // Return data
    res.json(memberVotesData.data);
  } catch (error) {
    console.error('Error fetching member votes:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;