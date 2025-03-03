const axios = require('axios');
const mongoose = require('mongoose');
const { URLSearchParams } = require('url');

const API_BASE_URL = 'https://api.openparliament.ca';

// Cache TTLs (in milliseconds)
const CACHE_TTL = {
  LIST: 5 * 60 * 1000,         // 5 minutes for list endpoints
  DETAIL: 30 * 60 * 1000,      // 30 minutes for detail endpoints
  MEMBER_VOTES: 10 * 60 * 1000 // 10 minutes for member votes
};

/**
 * Makes requests to the OpenParliament API with proper headers
 * @param {string} endpoint - API endpoint to request
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - Response data
 */
async function fetchFromAPI(endpoint, params = {}) {
  // Build URL with query parameters
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  
  // Always request JSON format
  url.searchParams.append('format', 'json');
  
  // Add API version parameter
  url.searchParams.append('version', 'v1');
  
  // Add any additional parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });

  console.log(`Fetching from OpenParliament API: ${url.toString()}`);

  try {
    // Add proper headers including User-Agent with contact email
    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'Parliament-Watch/1.0 (jrfchambers@gmail.com)',
      'API-Version': 'v1',
    };
    
    // Make the API request
    const response = await axios.get(url.toString(), { headers });
    console.log(`Successfully fetched data from ${endpoint}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching from ${endpoint}:`, error.message);
    
    if (error.response) {
      console.error(`API response status: ${error.response.status}`);
      console.error(`API response data:`, error.response.data);
    }
    
    throw new Error(`API request failed: ${error.message}`);
  }
}

/**
 * Get cache expiration time based on endpoint type
 * @param {string} endpoint - API endpoint
 * @returns {Date} - Expiration date
 */
function getCacheExpiration(endpoint) {
  let ttl = CACHE_TTL.LIST; // Default to list TTL
  
  if (endpoint.includes('/votes/') && !endpoint.endsWith('/votes/')) {
    ttl = CACHE_TTL.DETAIL;
  } else if (endpoint.includes('/bills/') && !endpoint.endsWith('/bills/')) {
    ttl = CACHE_TTL.DETAIL;
  } else if (endpoint.includes('/politicians/') && endpoint.includes('/votes/')) {
    ttl = CACHE_TTL.MEMBER_VOTES;
  } else if (endpoint.includes('/politicians/') && !endpoint.endsWith('/politicians/')) {
    ttl = CACHE_TTL.DETAIL;
  }
  
  return new Date(Date.now() + ttl);
}

module.exports = {
  fetchFromAPI,
  getCacheExpiration,
  CACHE_TTL
};