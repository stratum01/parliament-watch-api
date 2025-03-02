import axios from 'axios';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

const BASE_URL = 'https://api.openparliament.ca/v1';
const API_KEY = process.env.OPENPARLIAMENT_API_KEY;

export const fetchVotes = async (params = {}) => {
  const cacheKey = `votes-${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);
  
  if (cached) return cached;

  const response = await axios.get(`${BASE_URL}/votes/`, {
    params: {
      ...params,
      api_key: API_KEY,
    },
  });

  cache.set(cacheKey, response.data);
  return response.data;
};

export const fetchBills = async (params = {}) => {
  const cacheKey = `bills-${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);
  
  if (cached) return cached;

  const response = await axios.get(`${BASE_URL}/bills/`, {
    params: {
      ...params,
      api_key: API_KEY,
    },
  });

  cache.set(cacheKey, response.data);
  return response.data;
};

export const fetchMembers = async (params = {}) => {
  const cacheKey = `members-${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);
  
  if (cached) return cached;

  const response = await axios.get(`${BASE_URL}/politicians/`, {
    params: {
      ...params,
      api_key: API_KEY,
    },
  });

  cache.set(cacheKey, response.data);
  return response.data;
};

export const fetchMemberVotes = async (memberId, params = {}) => {
  const cacheKey = `member-votes-${memberId}-${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);
  
  if (cached) return cached;

  const response = await axios.get(`${BASE_URL}/politicians/${memberId}/votes/`, {
    params: {
      ...params,
      api_key: API_KEY,
    },
  });

  cache.set(cacheKey, response.data);
  return response.data;
};