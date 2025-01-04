module.exports = {
    RATE_LIMITS: {
        FREE_TIER: {
            requests_per_day: 5,
            concurrent_requests: 2
        },
        PAID_TIER: {
            requests_per_day: 100,
            concurrent_requests: 10
        },
        API_KEY_TIER: {
            requests_per_day: 1000,
            concurrent_requests: 50
        }
    },
    QUEUE_CONFIG: {
        maxQueueSize: 1000,          // Maximum items in queue
        jobTimeout: 5 * 60 * 1000,   // 5 minutes
        cleanupInterval: 60 * 1000,  // Cleanup every minute
        resultsTTL: 60 * 60 * 1000,  // Keep results for 1 hour
        maxRetries: 3,               // Maximum retries per job
        retryDelay: 5000,            // 5 seconds between retries
        maxConcurrent: 10,     // Maximum concurrent processing
        priorities: {
            default: 0,
            premium: 1,
            urgent: 2
        }
    },
    REDIS_CONFIG: {
        retryStrategy: (times) => Math.min(times * 50, 2000)
    }
}; 