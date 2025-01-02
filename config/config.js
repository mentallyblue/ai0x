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
        maxConcurrent: 50,
        stallInterval: 30000, // 30 seconds
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            }
        }
    }
}; 