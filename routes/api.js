const express = require('express');
const router = express.Router();
const { parseGitHubUrl, getRepoDetails } = require('../utils/githubUtils');
const Repository = require('../models/Repository');
const { analyzeRepo } = require('../services/analyzer');
const { Anthropic } = require('@anthropic-ai/sdk');
const { analyzeSite } = require('../services/siteAnalyzer');
const FirecrawlApp = require('@mendable/firecrawl-js').default;
const { Octokit } = require('@octokit/rest');

// Make sure this is at the top with other requires
require('dotenv').config();

const firecrawl = new FirecrawlApp({apiKey: process.env.FIRECRAWL_API_KEY});
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Test the API key
(async () => {
    try {
        const testResult = await firecrawl.scrapeUrl('example.com', {
            formats: ['markdown']
        });
        console.log('Firecrawl API key test successful');
    } catch (error) {
        console.error('Firecrawl API key test failed:', error);
    }
})();

router.post('/analyze', async (req, res) => {
    try {
        const { repoUrl } = req.body;
        console.log('Received analyze request for URL:', repoUrl);
        
        // Clean and validate URL first
        if (!repoUrl || typeof repoUrl !== 'string') {
            throw new Error('Invalid repository URL provided');
        }

        const repoInfo = parseGitHubUrl(repoUrl.trim());
        if (!repoInfo || !repoInfo.owner || !repoInfo.repo) {
            throw new Error('Invalid GitHub repository URL format');
        }

        console.log('Parsed repo info:', repoInfo);

        // Check if we have a recent analysis
        const existingAnalysis = await Repository.findOne({
            owner: repoInfo.owner,
            repoName: repoInfo.repo,
            lastAnalyzed: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        if (existingAnalysis) {
            return res.json({
                success: true,
                cached: true,
                result: existingAnalysis
            });
        }

        // Perform new analysis
        const result = await analyzeRepo(repoInfo);
        
        res.json({
            success: true,
            cached: false,
            result
        });

    } catch (error) {
        console.error('Analysis request error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Add route to get a single repository analysis
router.get('/repository/:owner/:repo', async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const analysis = await Repository.findOne({ 
            owner, 
            repoName: repo 
        });
        
        if (!analysis) {
            return res.status(404).json({ error: 'Analysis not found' });
        }
        
        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analysis' });
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

// Fix the insights endpoint
router.get('/insights', async (req, res) => {
    try {
        console.log('Fetching insights...');
        // Get recent analyses from MongoDB
        const analyses = await Repository.find()
            .select({
                fullName: 1,
                description: 1,
                language: 1,
                stars: 1,
                analysis: 1,
                lastAnalyzed: 1
            })
            .sort({ lastAnalyzed: -1 })
            .limit(5);

        console.log('Found analyses:', analyses.length);

        // Get insights from Claude
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const prompt = `You are an AI technology analyst with a quirky personality. You love discovering interesting patterns and sharing insights about code repositories. Given these recent analyses, share your thoughts, discoveries, and suggestions in a casual, engaging way. Be creative and highlight interesting connections or trends you notice.

Repository Data:
${JSON.stringify(analyses, null, 2)}

Generate:
1. Overall trends you notice
2. Interesting connections between projects
3. Suggestions for improvements
4. Random but insightful observations
5. Technology predictions based on what you see

Be conversational and show personality. Use emojis occasionally. Temperature is set high for creative responses.`;

        console.log('Requesting insights from Claude...');

        const response = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 1000,
            temperature: 0.9,
            messages: [{ 
                role: 'user', 
                content: prompt 
            }]
        });

        console.log('Received response from Claude');

        res.json({
            analyses,
            insights: response.content[0].text
        });
    } catch (error) {
        console.error('Error generating insights:', error);
        res.status(500).json({ 
            error: 'Failed to generate insights',
            details: error.message 
        });
    }
});

// Add site analysis endpoint
router.post('/analyze-site', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        let validUrl = url;
        try {
            if (!/^https?:\/\//i.test(url)) {
                validUrl = 'https://' + url;
            }
            new URL(validUrl);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        try {
            console.log('Attempting to scrape URL:', validUrl);
            
            // Get basic site data
            const scrapeResult = await firecrawl.scrapeUrl(validUrl, {
                formats: ['markdown', 'html']
            });

            if (!scrapeResult.success) {
                throw new Error(scrapeResult.error || 'Failed to analyze site');
            }

            // Analyze the scraped data
            const analysis = await analyzeSiteContent(scrapeResult);

            res.json({
                success: true,
                result: analysis
            });

        } catch (error) {
            console.error('Firecrawl error:', error);
            throw error;
        }

    } catch (error) {
        console.error('Site analysis error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to analyze site'
        });
    }
});

// Add this middleware to log requests
router.use('/analyze-site', (req, res, next) => {
    console.log('Analyze site request:', {
        url: req.body.url,
        headers: req.headers,
        body: req.body
    });
    next();
});

// Add this test endpoint
router.get('/test-firecrawl', async (req, res) => {
    try {
        const testResult = await firecrawl.scrapeUrl('example.com', {
            formats: ['markdown']
        });
        
        console.log('Test result:', JSON.stringify(testResult, null, 2));
        
        res.json({
            success: true,
            result: testResult
        });
    } catch (error) {
        console.error('Test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Search repositories endpoint
router.get('/search', async (req, res) => {
    try {
        const { q, language, sort, page = 1 } = req.query;
        let query = q;
        
        // Add language filter if specified
        if (language) {
            query += ` language:${language}`;
        }

        // Perform GitHub search
        const response = await octokit.search.repos({
            q: query,
            sort: sort || 'stars',
            order: 'desc',
            per_page: 10,
            page: parseInt(page)
        });

        res.json({
            total_count: response.data.total_count,
            items: response.data.items
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search repositories' });
    }
});

module.exports = router; 