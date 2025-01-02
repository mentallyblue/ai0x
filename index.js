require('dotenv').config();
const express = require('express');
const connectDB = require('./config/database');
const { analyzeRepo } = require('./services/analyzer');
const { extractRepoInfo } = require('./utils/githubUtils');
const Repository = require('./models/Repository');
const ApiKey = require('./models/ApiKey');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 3000;

// Get recent analyses
app.get('/api/recent', async (req, res) => {
    try {
        const recentAnalyses = await Repository.find()
            .sort({ lastAnalyzed: -1 })
            .limit(10)
            .select('fullName description language stars lastAnalyzed analysis');
        
        // Transform the data to ensure consistent format
        const formattedAnalyses = recentAnalyses.map(repo => ({
            fullName: repo.fullName,
            description: repo.description,
            language: repo.language,
            stars: repo.stars,
            lastAnalyzed: repo.lastAnalyzed,
            analysis: {
                larpScore: repo.analysis?.larpScore || null
            }
        }));
        
        res.json(formattedAnalyses);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch recent analyses' });
    }
});

// Get repository profile
app.get('/api/repository/:owner/:repo', async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const repository = await Repository.findOne({
            fullName: `${owner}/${repo}`
        });
        
        if (!repository) {
            return res.status(404).json({ error: 'Repository not found' });
        }
        
        res.json(repository);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch repository profile' });
    }
});

app.post('/api/analyze', async (req, res) => {
    try {
        const { repoUrl, apiKey } = req.body;
        const repoInfo = extractRepoInfo(repoUrl);
        
        if (!repoInfo) {
            return res.status(400).json({ error: 'Invalid GitHub repository URL' });
        }

        const result = await analyzeRepo(repoInfo, apiKey);
        res.json(result);
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze repository' });
    }
});

app.post('/api/cleanup', async (req, res) => {
    try {
        await Repository.deleteMany({});
        console.log('Cleared all repository analyses');
        res.json({ message: 'Successfully cleared all analyses' });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ error: 'Failed to clean up analyses' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 