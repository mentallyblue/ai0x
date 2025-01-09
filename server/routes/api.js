const Redis = require('ioredis');

const REDIS_URL = process.env.NODE_ENV === 'production' 
    ? process.env.REDIS_URL_PROD
    : process.env.REDIS_URL_DEV;

const redis = new Redis(REDIS_URL);

// Cache keys
const CACHE_KEYS = {
    ALL_ANALYSES: 'all_analyses',
    STATS: 'explore_stats'
};

// Add error handling for Redis connection
redis.on('error', (error) => {
    console.error('Redis connection error:', error);
});

redis.on('connect', () => {
    console.log('Connected to Redis successfully');
});

// Update the GET /api/analyses endpoint
router.get('/analyses', async (req, res) => {
    try {
        // Try cache first
        const cachedData = await redis.get(CACHE_KEYS.ALL_ANALYSES);
        if (cachedData) {
            console.log('Serving from cache');
            return res.json(JSON.parse(cachedData));
        }

        console.log('Cache miss, fetching from MongoDB');

        // If no cache, get from MongoDB with optimized query
        const analyses = await Analysis.find({}, {
            fullName: 1,
            stars: 1,
            forks: 1,
            language: 1,
            lastAnalyzed: 1,
            'analysis.legitimacyScore': 1,
            'analysis.trustScore': 1,
            description: 1,
            owner: 1,
            repoName: 1
        })
        .sort({ lastAnalyzed: -1 })
        .limit(100)
        .lean()
        .exec();

        if (!analyses) {
            throw new Error('No analyses found');
        }

        // Cache the results
        await redis.set(CACHE_KEYS.ALL_ANALYSES, JSON.stringify(analyses));
        
        console.log(`Sending ${analyses.length} analyses`);
        res.json(analyses);
    } catch (error) {
        console.error('Error in /api/analyses:', error);
        res.status(500).json({ 
            error: 'Failed to fetch analyses',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Update stats endpoint with caching
router.get('/stats', async (req, res) => {
    try {
        // Try cache first
        const cachedStats = await redis.get(CACHE_KEYS.STATS);
        if (cachedStats) {
            return res.json(JSON.parse(cachedStats));
        }

        const stats = await calculateStats(); // Your stats calculation function
        await redis.set(CACHE_KEYS.STATS, JSON.stringify(stats));
        
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Invalidate cache when new analysis is added
router.post('/analyze', async (req, res) => {
    try {
        // ... existing analysis code ...

        // After successful analysis, invalidate caches
        await Promise.all([
            redis.del(CACHE_KEYS.ALL_ANALYSES),
            redis.del(CACHE_KEYS.STATS)
        ]);

        res.json(result);
    } catch (error) {
        console.error('Analysis failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add to your analysis processing
function processAnalysis(analysis) {
    // Extract scores from fullAnalysis if they're not in detailedScores
    const scoreRegex = /## (\w+)\s*(?:Quality\s*)?Score:\s*(\d+)\/25/g;
    const scores = {
        codeQuality: 0,
        projectStructure: 0,
        implementation: 0,
        documentation: 0
    };

    let match;
    while ((match = scoreRegex.exec(analysis.fullAnalysis)) !== null) {
        const category = match[1].toLowerCase().replace(/\s+/g, '');
        const score = parseInt(match[2]);
        
        const categoryMap = {
            'code': 'codeQuality',
            'projectstructure': 'projectStructure',
            'implementation': 'implementation',
            'documentation': 'documentation'
        };
        
        if (categoryMap[category]) {
            scores[categoryMap[category]] = score;
        }
    }

    // Calculate legitimacy score
    const legitimacyScore = Math.round(
        (scores.codeQuality + 
         scores.projectStructure + 
         scores.implementation + 
         scores.documentation) / 100 * 100
    );

    return {
        ...analysis,
        detailedScores: scores,
        legitimacyScore: legitimacyScore || analysis.legitimacyScore
    };
}

// Add a health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
}); 