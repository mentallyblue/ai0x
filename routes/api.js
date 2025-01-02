const { queueTracker, analysisQueue } = require('../services/queueService');

router.get('/recommendations/:owner/:repo', async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const currentRepo = await Repository.findOne({ owner, repoName: repo });
        
        if (!currentRepo) {
            return res.status(404).json({ error: 'Repository not found' });
        }

        // Find similar repos based on language and LARP score range
        const similarRepos = await Repository.find({
            _id: { $ne: currentRepo._id },
            language: currentRepo.language,
            'analysis.larpScore': {
                $gte: (currentRepo.analysis?.larpScore || 0) - 10,
                $lte: (currentRepo.analysis?.larpScore || 100) + 10
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