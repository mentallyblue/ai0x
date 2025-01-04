const express = require('express');
const router = express.Router();
const { parseGitHubUrl } = require('../utils/githubUtils');
const Repository = require('../models/Repository');
const { queueTracker, analysisQueue } = require('../services/queueService');
const { queueLimiter, oneAnalysisPerIP, removeAnalysis } = require('../middleware/rateLimiter');
const { Anthropic } = require('@anthropic-ai/sdk');

// Make sure this is at the top with other requires
require('dotenv').config();

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
router.post('/analyze', queueLimiter, oneAnalysisPerIP, async (req, res) => {
    const clientIP = req.ip;
    try {
        const { repoUrl } = req.body;
        if (!repoUrl) {
            removeAnalysis(clientIP);
            return res.status(400).json({ error: 'Repository URL is required' });
        }

        console.log('Analyzing repo URL:', repoUrl);
        
        const repoInfo = parseGitHubUrl(repoUrl);
        if (!repoInfo || !repoInfo.owner || !repoInfo.repo) {
            return res.status(400).json({ error: 'Invalid GitHub repository URL' });
        }

        // Check for existing analysis that's less than 24 hours old
        const existingAnalysis = await Repository.findOne({
            owner: repoInfo.owner,
            repoName: repoInfo.repo,
            lastAnalyzed: { 
                $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
            }
        });

        if (existingAnalysis) {
            console.log('Found recent analysis, returning cached result');
            removeAnalysis(clientIP); // Remove from tracking since we're using cached
            return res.json({ 
                cached: true,
                result: {
                    repoDetails: {
                        fullName: existingAnalysis.fullName,
                        description: existingAnalysis.description,
                        language: existingAnalysis.language,
                        stars: existingAnalysis.stars,
                        forks: existingAnalysis.forks
                    },
                    analysis: existingAnalysis.analysis
                }
            });
        }

        // If no recent analysis exists, proceed with queue
        const jobId = await queueTracker.addToQueue(`${repoInfo.owner}/${repoInfo.repo}`);
        console.log('Added to queue with jobId:', jobId);
        
        queueTracker.trackAnalysis(jobId, clientIP);
        
        res.json({ jobId });
    } catch (error) {
        removeAnalysis(clientIP);
        console.error('Analysis error:', error);
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

module.exports = router; 