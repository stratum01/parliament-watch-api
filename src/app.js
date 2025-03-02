const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const morgan = require('morgan');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const { initScheduledJobs } = require('./services/scheduler');

// Import route handlers
const billsRoutes = require('./routes/bills');
const votesRoutes = require('./routes/votes');
const membersRoutes = require('./routes/members');

// Create Express app
const app = express();

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Log redacted connection string for debugging
    const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/parliament-watch';
    const redactedString = connectionString.replace(/:([^@]*)@/, ':****@');
    console.log(`Attempting to connect to MongoDB with: ${redactedString}`);
    
    await mongoose.connect(connectionString);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error details:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    
    // Don't exit immediately - this allows the app to start even if DB connection fails
    console.error('Failed to connect to MongoDB. The application will continue to run but database functionality will be unavailable.');
  }
};

// Call connectDB and initialize scheduler once connected
connectDB().then(() => {
  // Initialize scheduled jobs after DB connection
  initScheduledJobs();
});

// Middleware
app.use(helmet()); // Set security headers
app.use(compression()); // Compress responses
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request body
app.use(morgan('combined')); // Request logging

// API Routes
app.use('/api/bills', billsRoutes);
app.use('/api/votes', votesRoutes);
app.use('/api/members', membersRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

app.get('/api/db-test', async (req, res) => {
  try {
    // Test database connection
    const dbStatus = mongoose.connection.readyState;
    const statusMessages = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    res.json({
      connection: statusMessages[dbStatus] || 'unknown',
      database: mongoose.connection.name,
      host: mongoose.connection.host,
      models: Object.keys(mongoose.models)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Serve static assets for frontend
  app.use(express.static(path.join(__dirname, '../public')));

  // Any routes not matched by API will serve the SPA
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public', 'index.html'));
});}




// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Add this to your app.js temporarily
app.get('/api/admin/refresh-data', async (req, res) => {
  try {
    // Import models
    const Bill = require('./models/Bill');
    const Vote = require('./models/Vote');
    const Member = require('./models/Member');
    
    // Clear existing cache
    await Promise.all([
      Bill.deleteMany({}),
      Vote.deleteMany({}),
      Member.deleteMany({})
    ]);
    
    // Trigger data refresh
    const { updateRecentVotes, updateRecentBills } = require('./services/scheduler');
    await updateRecentVotes();
    await updateRecentBills();
    
    res.json({ success: true, message: 'Cache cleared and refresh triggered' });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = app;