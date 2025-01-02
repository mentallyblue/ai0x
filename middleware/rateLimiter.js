const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

const limiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: 'rate-limit:'
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: {
        error: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = limiter; 