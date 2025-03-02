// services/scheduler.js
const cron = require('node-cron');
const { fetchFromAPI, getCacheExpiration } = require('./proxy');
const Bill = require('../models/Bill');
const Vote = require('../models/Vote');
const Member = require('../models/Member');

/**
 * Initialize scheduled tasks for updating database
 */
function initScheduledJobs() {
  // Initial data load when server starts
  console.log('Running initial data load...');
  setTimeout(async () => {
    try {
      await updateRecentVotes();
      await updateRecentBills();
      console.log('Initial data load completed');
    } catch (error) {
      console.error('Error during initial data load:', error);
    }
  }, 5000); // Wait 5 seconds after server start
  // Update recent votes daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('Running scheduled update of recent votes');
    try {
      await updateRecentVotes();
      console.log('Recent votes update completed');
    } catch (error) {
      console.error('Error updating recent votes:', error);
    }
  });

  // Update recent bills daily at 4 AM
  cron.schedule('0 4 * * *', async () => {
    console.log('Running scheduled update of recent bills');
    try {
      await updateRecentBills();
      console.log('Recent bills update completed');
    } catch (error) {
      console.error('Error updating recent bills:', error);
    }
  });
  
  // Update active members weekly on Sunday at 2 AM
  cron.schedule('0 2 * * 0', async () => {
    console.log('Running scheduled update of member data');
    try {
      await updateMemberData();
      console.log('Member data update completed');
    } catch (error) {
      console.error('Error updating member data:', error);
    }
  });
  
  console.log('Scheduled jobs initialized');
}

module.exports = {
  initScheduledJobs,
  updateRecentVotes,
  updateRecentBills,
  updateMemberData
};

/**
 * Update recent votes (last 50)
 */
async function updateRecentVotes() {
  try {
    // Fetch the 50 most recent votes
    const votesData = await fetchFromAPI('/votes/', { limit: 50 });
    
    // Process and save each vote
    for (const voteItem of votesData.objects) {
      // Get full vote data
      const voteUrl = voteItem.url;
      const voteData = await fetchFromAPI(voteUrl);
      
      // Create expiration date (2 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 2);
      
      // Update or create vote in database
      await Vote.findOneAndUpdate(
        { number: voteItem.number, session: voteItem.session },
        {
          number: voteItem.number,
          session: voteItem.session,
          date: new Date(voteItem.date),
          result: voteItem.result,
          yea_total: voteItem.yea_total,
          nay_total: voteItem.nay_total,
          paired_total: voteItem.paired_total,
          description: voteItem.description,
          url: voteUrl,
          bill_url: voteItem.bill_url,
          bill_number: voteData.bill_number,
          party_votes: voteData.party_votes,
          members_votes: voteData.party_vote_details,
          data: voteData,
          expires: expiresAt,
          last_updated: new Date()
        },
        { upsert: true, new: true }
      );
    }
  } catch (error) {
    console.error('Error in updateRecentVotes:', error);
    throw error;
  }
}

/**
 * Update recent bills (last 50)
 */
async function updateRecentBills() {
  try {
    // Fetch the 50 most recent bills
    const billsData = await fetchFromAPI('/bills/', { limit: 50 });
    
    // Process and save each bill
    for (const billItem of billsData.objects) {
      // Get full bill data
      const billUrl = billItem.url;
      const billData = await fetchFromAPI(billUrl);
      
      // Create expiration date (3 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 3);
      
      // Update or create bill in database
      await Bill.findOneAndUpdate(
        { number: billItem.number, session: billItem.session },
        {
          number: billItem.number,
          session: billItem.session,
          url: billUrl,
          introduced: new Date(billItem.introduced),
          name: billItem.name,
          legisinfo_id: billItem.legisinfo_id,
          status: billData.status,
          sponsor: billData.sponsor_politician_url,
          text_url: billData.text_url,
          law_url: billData.law_url,
          summary: billData.summary_html,
          data: billData,
          expires: expiresAt,
          last_updated: new Date()
        },
        { upsert: true, new: true }
      );
    }
  } catch (error) {
    console.error('Error in updateRecentBills:', error);
    throw error;
  }
}

/**
 * Update member data
 */
async function updateMemberData() {
  try {
    // We'll need to page through all members
    let offset = 0;
    const limit = 50;
    let hasMore = true;
    
    while (hasMore) {
      // Fetch a page of members
      const membersData = await fetchFromAPI('/politicians/', { limit, offset });
      
      // Process each member
      for (const memberItem of membersData.objects) {
        // Get full member data
        const memberUrl = memberItem.url;
        const memberData = await fetchFromAPI(memberUrl);
        
        // Create expiration date (7 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        // Update or create member in database
        await Member.findOneAndUpdate(
          { url: memberUrl },
          {
            name: memberData.name,
            url: memberUrl,
            party: memberData.party,
            constituency: memberData.constituency,
            province: memberData.province,
            photo_url: memberData.image,
            email: memberData.email,
            phone: memberData.phone,
            roles: memberData.roles,
            offices: memberData.offices,
            data: memberData,
            expires: expiresAt,
            last_updated: new Date()
          },
          { upsert: true, new: true }
        );
      }
      
      // Check if we have more members to fetch
      offset += limit;
      hasMore = membersData.objects.length === limit && membersData.pagination.next_url;
    }
  } catch (error) {
    console.error('Error in updateMemberData:', error);
    throw error;
  }