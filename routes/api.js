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