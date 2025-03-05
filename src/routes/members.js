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
 * Get ballots for a specific member
 * @route GET /api/members/:memberName/ballots
 */
router.get('/members/:memberName/ballots', async (req, res) => {
  try {
    const { memberName } = req.params;
    
    // Check cache first
    const cacheKey = `member_ballots_${memberName}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log(`Returning cached ballots for ${memberName}`);
      return res.json(cachedData);
    }
    
    // If not in cache, fetch from OpenParliament API
    console.log(`Fetching ballots for ${memberName} from OpenParliament API`);
    
    // Construct API URL
    const apiUrl = `https://api.openparliament.ca/votes/ballots/?politician=${memberName}&format=json&limit=50`;
    
    // Make the request to OpenParliament API
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Parliament Watch/1.0',
        'Accept': 'application/json'
      },
      timeout: 5000 // 5 second timeout
    });
    
    // Get the ballots from the response
    const ballotsData = response.data;
    
    // Check if we got some ballots
    if (!ballotsData.objects || ballotsData.objects.length === 0) {
      console.log(`No ballots found for ${memberName}`);
      return res.status(404).json({ 
        error: 'No voting history found for this member' 
      });
    }
    
    // Enrich ballots with vote details (for the first 10 to avoid too many requests)
    const enrichedBallots = [];
    const maxBallotsToEnrich = Math.min(10, ballotsData.objects.length);
    
    for (let i = 0; i < maxBallotsToEnrich; i++) {
      const ballot = ballotsData.objects[i];
      
      try {
        // Extract vote ID from vote_url
        const voteUrlParts = ballot.vote_url.split('/').filter(Boolean);
        if (voteUrlParts.length >= 3) {
          const voteSession = voteUrlParts[voteUrlParts.length - 3]; // e.g., "44-1"
          const voteNumber = voteUrlParts[voteUrlParts.length - 1]; // e.g., "928"
          
          // Fetch vote details
          const voteUrl = `https://api.openparliament.ca/votes/${voteSession}/${voteNumber}/?format=json`;
          const voteResponse = await axios.get(voteUrl, {
            headers: {
              'User-Agent': 'Parliament Watch/1.0',
              'Accept': 'application/json'
            },
            timeout: 5000
          });
          
          const voteData = voteResponse.data;
          
          // Add vote details to ballot
          enrichedBallots.push({
            ...ballot,
            vote_details: voteData,
            date: voteData.date,
            description: voteData.description,
            result: voteData.result,
            bill_number: voteData.bill ? voteData.bill.number : null
          });
        } else {
          // If we can't parse the vote_url, just add the original ballot
          enrichedBallots.push(ballot);
        }
      } catch (error) {
        console.error(`Error enriching ballot for ${memberName}:`, error.message);
        // If we can't enrich the ballot, just add the original
        enrichedBallots.push(ballot);
      }
    }
    
    // Add any remaining ballots that weren't enriched
    for (let i = maxBallotsToEnrich; i < ballotsData.objects.length; i++) {
      enrichedBallots.push(ballotsData.objects[i]);
    }
    
    // Create the response data
    const responseData = {
      ...ballotsData,
      objects: enrichedBallots
    };
    
    // Cache the response for 1 hour (3600000 ms)
    cache.set(cacheKey, responseData, 3600000);
    
    // Send the enriched data
    res.json(responseData);
  } catch (error) {
    console.error('Error fetching member ballots:', error.message);
    res.status(500).json({ 
      error: 'Error fetching voting history',
      details: error.message 
    });
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
      try {
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
      } catch (apiError) {
        console.error(`Error fetching votes from OpenParliament for ${memberName}:`, apiError);
        
        // Instead of propagating error, return empty result structure
        return res.json({
          objects: [],
          pagination: {
            count: 0,
            next_url: null,
            previous_url: null,
            limit: parseInt(limit),
            offset: parseInt(offset)
          },
          message: `No votes available for ${memberName} or API error occurred`,
          error_details: process.env.NODE_ENV === 'development' ? apiError.message : undefined
        });
      }
    }
    
    // Return data
    res.json(memberVotesData.data);
  } catch (error) {
    console.error('Error in member votes endpoint:', error);
    
    // Return empty result structure instead of 500 error
    res.json({
      objects: [],
      pagination: {
        count: 0, 
        next_url: null,
        previous_url: null
      },
      message: 'Error retrieving votes data'
    });
  }
});

module.exports = router;