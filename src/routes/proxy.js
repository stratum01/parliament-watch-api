const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

/**
 * Proxy route for OpenParliament API
 * This avoids CORS issues by having the server make the request
 */
router.get('/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Validate the URL is for the OpenParliament API
    if (!targetUrl.startsWith('https://api.openparliament.ca')) {
      return res.status(403).json({ error: 'Only OpenParliament API requests are allowed' });
    }
    
    // Forward the request to the API
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Parliament-Watch/1.0 (jrfchambers@gmail.com)',
        'API-Version': 'v1',
      },
    });
    
    // Get response headers
    const headers = response.headers.raw();
    
    // Forward relevant headers
    const allowedHeaders = ['content-type', 'cache-control', 'api-version'];
    Object.keys(headers).forEach(header => {
      if (allowedHeaders.includes(header.toLowerCase())) {
        res.setHeader(header, headers[header]);
      }
    });
    
    // Get the response body
    const data = await response.text();
    
    // Send the response
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch from API' });
  }
});

module.exports = router;