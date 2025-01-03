const { queueTracker, analysisQueue } = require('../services/queueService');

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
        console.error('Recommendations error:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

// Add route to get a single repository analysis
router.get('/repository/:owner/:repo', async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const analysis = await Repository.findOne({ 
            owner, 
            repoName: repo 
        }).select({
            fullName: 1,
            description: 1,
            language: 1,
            stars: 1,
            forks: 1,
            lastAnalyzed: 1,
            analysis: 1,  // Select all analysis fields
            summary: 1
        });

        if (!analysis) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        // Log the response for debugging
        console.log('Repository analysis response:', {
            repo: analysis.fullName,
            scores: {
                final: analysis.analysis?.finalLegitimacyScore,
                technical: analysis.analysis?.legitimacyScore,
                trust: analysis.analysis?.trustScore
            }
        });

        res.json(analysis);
    } catch (error) {
        console.error('Error fetching repository analysis:', error);
        res.status(500).json({ error: 'Failed to fetch repository analysis' });
    }
});

// Update the analyses endpoint to include all score data
router.get('/analyses', async (req, res) => {
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

        // Add logging to debug
        console.log('Fetched analyses:', analyses.map(a => ({
            repo: a.fullName,
            scores: {
                final: a.analysis?.finalLegitimacyScore,
                technical: a.analysis?.legitimacyScore,
                trust: a.analysis?.trustScore
            }
        })));

        res.json(analyses);
    } catch (error) {
        console.error('Error fetching analyses:', error);
        res.status(500).json({ error: 'Failed to fetch analyses' });
    }
});

// Update the recent endpoint to include all score data
router.get('/recent', async (req, res) => {
    try {
        console.log('Fetching recent analyses...');
        
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

// Update the analyze endpoint
router.post('/analyze', async (req, res) => {
    try {
        const { repoUrl } = req.body;
        if (!repoUrl) {
            return res.status(400).json({ error: 'Repository URL is required' });
        }

        // Add logging to debug
        console.log('Analyzing repo URL:', repoUrl);
        
        const repoInfo = parseGitHubUrl(repoUrl);
        if (!repoInfo || !repoInfo.owner || !repoInfo.repo) {
            return res.status(400).json({ error: 'Invalid GitHub repository URL' });
        }

        // Add to queue
        const jobId = await queueTracker.addToQueue(`${repoInfo.owner}/${repoInfo.repo}`);
        console.log('Added to queue with jobId:', jobId);
        
        res.json({ jobId });
    } catch (error) {
        console.error('Analysis error:', error); // Add detailed error logging
        res.status(500).json({ 
            error: error.message || 'Failed to analyze repository',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Add new endpoint for queue position
router.get('/queue-position/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const queueInfo = await queueTracker.getQueuePosition(jobId);
        res.json(queueInfo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}); 