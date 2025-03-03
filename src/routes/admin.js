const express = require('express');
const router = express.Router();
const { updateMemberData, updateRecentBills, updateRecentVotes } = require('../services/scheduler');

// Route to manually update member data
router.post('/refresh/members', async (req, res) => {
  try {
    console.log('Manually triggering member data update');
    await updateMemberData();
    res.json({ success: true, message: 'Member data update triggered successfully' });
  } catch (error) {
    console.error('Error during manual member update:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route to manually update bills data
router.post('/refresh/bills', async (req, res) => {
  try {
    console.log('Manually triggering bills data update');
    await updateRecentBills();
    res.json({ success: true, message: 'Bills data update triggered successfully' });
  } catch (error) {
    console.error('Error during manual bills update:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route to manually update votes data
router.post('/refresh/votes', async (req, res) => {
  try {
    console.log('Manually triggering votes data update');
    await updateRecentVotes();
    res.json({ success: true, message: 'Votes data update triggered successfully' });
  } catch (error) {
    console.error('Error during manual votes update:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;