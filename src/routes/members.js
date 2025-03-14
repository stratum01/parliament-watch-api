const express = require('express');
const router = express.Router();
const axios = require('axios');
const cache = require('../services/cache');
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
 * Get real voting history for a specific member
 * @route GET /api/members/:memberName/real-votes
 */
router.get('/:memberName/real-votes', async (req, res) => {
  try {
    const { memberName } = req.params;
    
    // Check cache first
    const cacheKey = `member_real_votes_${memberName}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log(`Returning cached real votes for ${memberName}`);
      return res.json(cachedData);
    }
    
    console.log(`Fetching real votes for ${memberName} from OpenParliament API`);
    
    // Step 1: Fetch the member's ballots
    const ballotsUrl = `https://api.openparliament.ca/votes/ballots/?politician=${memberName}&format=json&limit=20`;
    console.log(`Fetching ballots from: ${ballotsUrl}`);
    
    let ballotsData;
    try {
      const ballotsResponse = await axios.get(ballotsUrl, {
        headers: {
          'User-Agent': 'Parliament Watch/1.0',
          'Accept': 'application/json'
        },
        timeout: 8000
      });
      
      ballotsData = ballotsResponse.data;
      console.log(`Found ${ballotsData.objects?.length || 0} ballots for ${memberName}`);
    } catch (ballotsError) {
      console.error(`Error fetching ballots: ${ballotsError.message}`);
      return res.status(500).json({
        error: 'Failed to fetch ballot data',
        details: ballotsError.message
      });
    }
    
    if (!ballotsData.objects || ballotsData.objects.length === 0) {
      console.log(`No ballots found for ${memberName}`);
      return res.status(404).json({
        error: 'No voting history found for this member'
      });
    }
    // Step 2: Enrich ballots with vote details (for the first 10 to avoid too many requests)
    const enrichedVotes = [];
    const maxBallotsToEnrich = Math.min(10, ballotsData.objects.length);
    
    for (let i = 0; i < maxBallotsToEnrich; i++) {
      const ballot = ballotsData.objects[i];
      
      try {
        // Extract vote session and number from vote_url
        // Format is typically: /votes/44-1/928/
        const voteUrlParts = ballot.vote_url.split('/').filter(Boolean);
        
        if (voteUrlParts.length >= 3) {
          const voteSession = voteUrlParts[voteUrlParts.length - 3]; // e.g., "44-1"
          const voteNumber = voteUrlParts[voteUrlParts.length - 1]; // e.g., "928"
          
          // Fetch vote details
          const voteUrl = `https://api.openparliament.ca/votes/${voteSession}/${voteNumber}/?format=json`;
          console.log(`Fetching vote details from: ${voteUrl}`);
          
          const voteResponse = await axios.get(voteUrl, {
            headers: {
              'User-Agent': 'Parliament Watch/1.0',
              'Accept': 'application/json'
            },
            timeout: 5000
          });
          
          const voteData = voteResponse.data;
          
          // Format vote data for frontend consumption
          enrichedVotes.push({
            id: `${voteSession}-${voteNumber}`,
            vote_url: ballot.vote_url,
            bill: voteData.bill ? `Bill ${voteData.bill.number}` : 'Motion',
            bill_number: voteData.bill ? voteData.bill.number : null,
            description: typeof voteData.description === 'object' ? 
              voteData.description.en : voteData.description,
            date: voteData.date,
            vote: ballot.ballot === 'Yes' ? 'Yea' : ballot.ballot === 'No' ? 'Nay' : ballot.ballot,
            result: voteData.result || (voteData.passed ? 'Passed' : 'Failed'),
            // Include raw data for debugging or future enhancements
            raw_ballot: ballot,
            raw_vote: voteData
          });
        } else {
          console.warn(`Invalid vote_url format: ${ballot.vote_url}`);
          // Add minimal ballot data if we can't parse the URL properly
          enrichedVotes.push({
            id: ballot.vote_url,
            vote_url: ballot.vote_url,
            bill: 'Unknown',
            description: 'Vote details unavailable',
            date: 'Unknown date',
            vote: ballot.ballot,
            result: 'Unknown',
            raw_ballot: ballot
          });
        }
      } catch (voteError) {
        console.error(`Error fetching vote details for ${ballot.vote_url}: ${voteError.message}`);
        // Add minimal ballot data if we encounter an error
        enrichedVotes.push({
          id: ballot.vote_url,
          vote_url: ballot.vote_url,
          bill: 'Unknown',
          description: 'Error fetching vote details',
          date: 'Unknown date',
          vote: ballot.ballot,
          result: 'Unknown',
          raw_ballot: ballot,
          error: voteError.message
        });
      }
    }
    
    // Add any remaining ballots with minimal data
    for (let i = maxBallotsToEnrich; i < ballotsData.objects.length; i++) {
      const ballot = ballotsData.objects[i];
      enrichedVotes.push({
        id: ballot.vote_url,
        vote_url: ballot.vote_url,
        bill: 'Motion', // Default to Motion without enrichment
        description: 'Additional vote (details not loaded)',
        date: 'Unknown date',
        vote: ballot.ballot,
        result: 'Unknown',
        raw_ballot: ballot
      });
    }
    
    // Create the response
    const responseData = {
      objects: enrichedVotes,
      pagination: ballotsData.pagination,
      meta: {
        member: memberName,
        enriched_count: maxBallotsToEnrich,
        total_count: ballotsData.objects.length
      }
    };
    
    // Cache the response for 1 hour (3600000 ms)
    cache.set(cacheKey, responseData, 3600000);
    
    // Send the enriched data
    return res.json(responseData);
  } catch (error) {
    console.error(`Error in real-votes endpoint: ${error.message}`);
    return res.status(500).json({
      error: 'Failed to retrieve voting history',
      details: error.message
    });
  }
});

/**
 * Get ballots for a specific member
 * @route GET /api/members/:memberName/ballots
 */
router.get('/:memberName/ballots', async (req, res) => {
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

// Just for testing - return mock data for votes
router.get('/:memberName/mock-votes', (req, res) => {
  const { memberName } = req.params;
  
  // Create mock votes with realistic patterns
  const mockVotes = [
    {
      id: 'mock-1',
      bill: 'Bill C-56',
      description: 'Affordable Housing and Public Transit Act',
      date: '2024-11-20',
      vote: 'Yea',
      result: 'Passed'
    },
    {
      id: 'mock-2',
      bill: 'Motion',
      description: 'Opposition Motion (Confidence in the government)',
      date: '2024-11-15',
      vote: 'Yea',
      result: 'Passed'
    },
    {
      id: 'mock-3',
      bill: 'Bill C-45',
      description: 'Cannabis Regulation Amendment Act',
      date: '2024-10-28',
      vote: 'Yea',
      result: 'Passed'
    },
    {
      id: 'mock-4',
      bill: 'Bill C-35',
      description: 'Canada Early Learning and Child Care Act',
      date: '2024-10-12',
      vote: 'Nay', 
      result: 'Passed'
    },
    {
      id: 'mock-5',
      bill: 'Bill C-63',
      description: 'Online Streaming Act',
      date: '2024-09-30',
      vote: 'Yea',
      result: 'Passed'
    },
  ];
  
  res.json({
    objects: mockVotes,
    pagination: {
      count: mockVotes.length,
      next: null,
      previous: null
    }
  });
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