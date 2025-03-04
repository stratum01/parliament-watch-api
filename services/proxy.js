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
 * Fetch data from OpenParliament API with error handling
 * @param {string} path - API path to fetch
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - API response data
 */
const fetchFromAPI = async (path, params = {}) => {
  try {
    // Build URL with query parameters
    const url = new URL(`${OPENPARLIAMENT_BASE_URL}${path}`);
    
    // Always request JSON format
    url.searchParams.append('format', 'json');
    url.searchParams.append('version', 'v1');
    
    // Add other params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    
    console.log(`Fetching from OpenParliament API: ${url.toString()}`);
    
    // Make the request with timeout and proper headers
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Parliament Watch/1.0 (https://github.com/yourusername/parliament-watch)'
      },
      timeout: 10000 // 10 second timeout
    });
    
    // Check if response is OK
    if (!response.ok) {
      const errorText = await response.text().catch(e => 'No error text available');
      console.error(`API Error ${response.status}: ${errorText}`);
      throw new Error(`OpenParliament API responded with status ${response.status}`);
    }
    
    // Parse JSON response
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching from API (${path}):`, error);
    
    // Rethrow with more context
    throw new Error(`Failed to fetch data from OpenParliament API: ${error.message}`);
  }
};

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