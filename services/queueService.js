const Queue = require('bull');
const Redis = require('ioredis');
const config = require('../config/config');

// Create Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Create analysis queue
const analysisQueue = new Queue('repository-analysis', {
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
    defaultJobOptions: config.QUEUE_CONFIG.defaultJobOptions
});

// Rate limiting by API key
const rateLimiter = {
    async checkLimit(apiKey, tier) {
        const today = new Date().toISOString().split('T')[0];
        const keyCount = `rate_limit:${apiKey}:${today}`;
        
        const count = await redis.incr(keyCount);
        if (count === 1) {
            await redis.expire(keyCount, 86400); // 24 hours
        }
        
        const limit = config.RATE_LIMITS[tier].requests_per_day;
        return count <= limit;
    }
};

// API Key management
const apiKeyManager = {
    async validateKey(apiKey) {
        const keyInfo = await redis.hgetall(`apikey:${apiKey}`);
        return keyInfo.valid === 'true' ? keyInfo : null;
    },
    
    async registerKey(apiKey, tier, owner) {
        await redis.hmset(`apikey:${apiKey}`, {
            tier,
            owner,
            valid: 'true',
            created: Date.now()
        });
    }
};

module.exports = { analysisQueue, rateLimiter, apiKeyManager }; 