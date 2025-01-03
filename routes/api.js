const express = require('express');
const router = express.Router();
const { validateGitHubUrl } = require('../middleware/validateRequest');
const { analyzeLimiter, apiLimiter, trackRequest } = require('../middleware/rateLimiter');
const { queueTracker } = require('../services/queueService');
const Repository = require('../models/Repository');

// Apply rate limiting and request tracking to all routes
router.use(trackRequest);

// Apply specific rate limits to different endpoints
router.post('/analyze', analyzeLimiter, validateGitHubUrl, async (req, res) => {
    try {
        const { owner, repo } = req.githubRepo;
        const jobId = await queueTracker.addToQueue(`${owner}/${repo}`);

        if (typeof jobId === 'object' && jobId.error) {
            return res.status(429).json({ error: jobId.error });
        }

        res.json({ jobId });
    } catch (error) {
        console.error('Analysis request error:', error);
        res.status(500).json({ error: 'Failed to queue analysis request' });
    }
});

// Add rate limiting to API endpoints
router.get('/analyses', apiLimiter, async (req, res) => {
    try {
        const analyses = await Repository.find()
            .select({
                fullName: 1,
                description: 1,
                language: 1,
                stars: 1,
                forks: 1,
                lastAnalyzed: 1,
                'analysis.detailedScores': 1,
                'analysis.legitimacyScore': 1,
                'analysis.trustScore': 1,
                'analysis.finalLegitimacyScore': 1,
                summary: 1
            })
            .sort({ lastAnalyzed: -1 });

        res.json(analyses);
    } catch (error) {
        console.error('Error fetching analyses:', error);
        res.status(500).json({ error: 'Failed to fetch analyses' });
    }
});

router.get('/recent', apiLimiter, async (req, res) => {
    try {
        const analyses = await Repository.find()
            .select({
                fullName: 1,
                description: 1,
                language: 1,
                stars: 1,
                forks: 1,
                lastAnalyzed: 1,
                summary: 1
            })
            .sort({ lastAnalyzed: -1 })
            .limit(10);

        res.json(analyses);
    } catch (error) {
        console.error('Error fetching recent analyses:', error);
        res.status(500).json({ error: 'Failed to fetch recent analyses' });
    }
});

router.get('/queue-position/:jobId', apiLimiter, async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!jobId) {
            return res.status(400).json({ error: 'Job ID is required' });
        }

        const queueInfo = await queueTracker.getQueuePosition(jobId);
        
        if (queueInfo.status === 'not_found') {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(queueInfo);
    } catch (error) {
        console.error('Queue position error:', error);
        res.status(500).json({ error: 'Failed to get queue position' });
    }
});

router.get('/repository/:owner/:repo', apiLimiter, async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const repository = await Repository.findOne({ 
            owner, 
            repoName: repo 
        });

        if (!repository) {
            return res.status(404).json({ error: 'Repository not found' });
        }

        res.json(repository);
    } catch (error) {
        console.error('Repository fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch repository analysis' });
    }
});

// Recommendations endpoint
router.get('/recommendations/:owner/:repo', async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const currentRepo = await Repository.findOne({ owner, repoName: repo });
        
        if (!currentRepo) {
            return res.status(404).json({ error: 'Repository not found' });
        }

        // Find similar repos based on language and legitimacy score range
        const similarRepos = await Repository.find({
            _id: { $ne: currentRepo._id },
            language: currentRepo.language,
            'analysis.finalLegitimacyScore': {
                $gte: (currentRepo.analysis?.finalLegitimacyScore || 0) - 10,
                $lte: (currentRepo.analysis?.finalLegitimacyScore || 100) + 10
            }
        })
        .sort({ stars: -1 })
        .limit(5);

        res.json(similarRepos);
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

// Stats endpoint
router.get('/stats', apiLimiter, async (req, res) => {
    try {
        const totalRepos = await Repository.countDocuments();
        const recentAnalyses = await Repository.countDocuments({
            lastAnalyzed: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        const averageScore = await Repository.aggregate([
            {
                $group: {
                    _id: null,
                    avgScore: { $avg: '$analysis.finalLegitimacyScore' }
                }
            }
        ]);

        res.json({
            totalRepositories: totalRepos,
            recentAnalyses,
            averageScore: averageScore[0]?.avgScore || 0
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router; 