const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

// Create different limiters for different endpoints
const analyzeLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: 'rate-limit:analyze:'
    }),
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 10, // 10 requests per day
    message: {
        error: 'Daily analysis limit reached. Please try again tomorrow.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use both IP and user agent to prevent simple IP spoofing
        return `${req.ip}-${req.headers['user-agent']}`;
    }
});

const apiLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: 'rate-limit:api:'
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: {
        error: 'Too many requests, please try again later.'
    }
});

// Add request tracking
redis.on('error', (err) => {
    console.error('Redis error:', err);
});

const trackRequest = async (req, res, next) => {
    try {
        const key = `request:${req.ip}:${Date.now()}`;
        await redis.setex(key, 86400, JSON.stringify({
            ip: req.ip,
            path: req.path,
            userAgent: req.headers['user-agent'],
            timestamp: Date.now()
        }));
    } catch (error) {
        console.error('Request tracking error:', error);
    }
    next();
};

module.exports = {
    analyzeLimiter,
    apiLimiter,
    trackRequest
}; 