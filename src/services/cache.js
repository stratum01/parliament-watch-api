import NodeCache from 'node-cache';

class CacheService {
  constructor(ttlSeconds = 300) { // Default 5 minute cache
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: ttlSeconds * 0.2,
      useClones: false
    });
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    return this.cache.set(key, value);
  }

  delete(key) {
    return this.cache.del(key);
  }

  flush() {
    return this.cache.flushAll();
  }

  // Add cache middleware for Express
  middleware(duration) {
    return (req, res, next) => {
      const key = req.originalUrl || req.url;
      const cachedResponse = this.get(key);

      if (cachedResponse) {
        res.send(cachedResponse);
        return;
      }

      res.sendResponse = res.send;
      res.send = (body) => {
        this.set(key, body, duration);
        res.sendResponse(body);
      };
      next();
    };
  }
}

export default new CacheService();
