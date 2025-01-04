require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});
const connectDB = require('./config/database');
const { analyzeRepo } = require('./services/analyzer');
const { extractRepoInfo } = require('./utils/githubUtils');
const Repository = require('./models/Repository');
const ApiKey = require('./models/ApiKey');
const apiRouter = require('./routes/api');
const { Anthropic } = require('@anthropic-ai/sdk');
const { Scraper } = require('agent-twitter-client');

// Set up middleware
app.use(express.json());
app.use(express.static('public'));

// Set up Socket.IO
global.io = io;

io.on('connection', (socket) => {
    console.log('Client connected');
    
    // Send current insights to newly connected clients
    if (currentInsights) {
        socket.emit('insightsUpdate', currentInsights);
    }

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });

    socket.on('requestInsightsRefresh', async () => {
        try {
            // Force a refresh of insights
            const response = await fetch(`http://localhost:${PORT}/api/insights`);
            const data = await response.json();
            io.emit('insightsUpdate', data);
        } catch (error) {
            console.error('Error refreshing insights:', error);
            socket.emit('insightsError', { message: 'Failed to refresh insights' });
        }
    });
});

// Now import queueTracker after Socket.IO is set up
const { queueTracker } = require('./services/queueService');

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 3000;

// Add these variables at the top
let currentInsights = null;
let lastInsightUpdate = null;
const UPDATE_INTERVAL = 3600000; // 1 hour instead of 5 minutes
let updateInterval;
let twitterClient;
const TWEET_INTERVAL = 3600000 * 4; // Tweet every 4 hours
let lastTweetTime = null;
const MIN_TWEET_INTERVAL = 300000; // 5 minutes minimum between tweets
let lastTweetContent = null; // Store last tweet to prevent duplicates

// Initialize Twitter client
async function initializeTwitterClient() {
    try {
        twitterClient = new Scraper();
        await twitterClient.login(
            process.env.TWITTER_USERNAME,
            process.env.TWITTER_PASSWORD,
            process.env.TWITTER_EMAIL
        );
        console.log('Twitter client initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Twitter client:', error);
    }
}

// Add this function after other function definitions
async function tweetInsights(insights) {
    if (!twitterClient) return;
    
    // Check minimum time interval
    if (lastTweetTime && (Date.now() - lastTweetTime) < MIN_TWEET_INTERVAL) {
        console.log('Skipping tweet - too soon since last update');
        return;
    }
    
    try {
        // Extract key sections using regex
        const marketSection = insights.match(/# AI0x Market Index 📊\n(.*?)\n/s);
        const topPerformers = insights.match(/# Top Performers 🏆\n(.*?)(?=\n#)/s);
        const trends = insights.match(/# Market Trends 📈\n(.*?)(?=\n#)/s);
        
        if (!marketSection || !topPerformers) return;
        
        // Get top performers
        const topRepos = topPerformers[1].match(/\*\*(.*?)\*\*/g)
            ?.map(repo => repo.replace(/\*\*/g, ''))
            ?.slice(0, 2) || [];

        // Create tweet content
        const tweetText = `yo just ran our daily market scan
        
${marketSection[1].toLowerCase()}

been keeping an eye on ${topRepos[0]}, looking pretty solid rn

${trends[1].trim().split('\n')[0].toLowerCase()}

check out the full breakdown on ai0x.dev if ur interested`;
        
        const tweet = tweetText.replace(/\n\s+/g, '\n').trim();

        // Check for duplicate content
        if (tweet === lastTweetContent) {
            console.log('Skipping duplicate tweet');
            return;
        }

        await twitterClient.sendTweet(tweet);
        lastTweetTime = Date.now();
        lastTweetContent = tweet;
        
        // For follow-up tweets, also check for duplicates
        if (topPerformers[1].includes('Investment Rating: A')) {
            const followUpTweet = `btw if anyones looking for some serious projects to check out

${topRepos.slice(0, 2).join(' and ')} are both showing some real potential

not financial advice obviously but worth taking a look`;
            
            // Only send follow-up if it's different from the last tweet
            if (followUpTweet !== lastTweetContent) {
                setTimeout(async () => {
                    await twitterClient.sendTweet(followUpTweet);
                    lastTweetContent = followUpTweet;
                }, 2000);
            }
        }
        
    } catch (error) {
        console.error('Failed to send tweet:', error);
    }
}

// Add an interval to check for updates
function startInsightUpdates() {
    updateInterval = setInterval(async () => {
        try {
            const analyses = await Repository.find()
                .sort({ lastAnalyzed: -1 })
                .select('lastAnalyzed')
                .limit(1);
            
            // Only refreshes if there's new analysis data
            if (analyses[0] && analyses[0].lastAnalyzed > lastInsightUpdate) {
                const response = await fetch(`http://localhost:${PORT}/api/insights`);
                const data = await response.json();
                io.emit('insightsUpdate', data);
            }
        } catch (error) {
            console.error('Auto-update check failed:', error);
        }
    }, UPDATE_INTERVAL);
}

// Start the update interval when the server starts
startInsightUpdates();

// Clean up on server shutdown
process.on('SIGTERM', () => {
    clearInterval(updateInterval);
});

// Add the insights endpoint here
app.get('/api/insights', async (req, res) => {
    try {
        if (currentInsights && lastInsightUpdate && (Date.now() - lastInsightUpdate) < 300000) {
            return res.json(currentInsights);
        }

        console.log('Initiating AI0x market analysis...');
        const analyses = await Repository.find()
            .select({
                fullName: 1,
                description: 1,
                language: 1,
                stars: 1,
                forks: 1,
                analysis: 1,
                lastAnalyzed: 1,
                summary: 1,
                codeReview: 1,
                securityAnalysis: 1
            })
            .sort({ lastAnalyzed: -1 });

        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const prompt = `You are AI0x, a technical market analyst specialized in code repositories. Share your real-time market analysis.

Current Analysis:
You're analyzing ${analyses.length} repositories to determine their technical merit and investment potential.

Format your analysis EXACTLY as follows (include all sections and fields):

# AI0x Market Index 📊
[Market health score: 0-100]
[One sentence market summary]

# Top Performers 🏆
[For each repository, format EXACTLY as:]
**{full_repository_name}**
N/A [Investment Rating: A+, A, B+, B, C+, C]
[Key Strength: one line]
[Market Potential: one line]
[Risk Level: Low/Medium/High]

# Market Trends 📈
[2-3 sentences on emerging patterns and market direction]

# Technical Edge 💡
[For each notable repository:]
→ {repository_name}: [one line technical advantage]

# Investment Signals 🎯
[For each repository, format EXACTLY as:]
{repository_name}
Growth: [0-10]
Moat: [0-10]
Timing: [0-10]
Risk: [Low/Medium/High]

Repository Data:
${JSON.stringify(analyses, null, 2)}

Style Guide:
- Use EXACT formatting as shown above
- Include ALL fields for each section
- Use consistent rating scales
- Be precise with numbers
- Keep insights concise

Remember: This is a live market analysis feed. Be accurate and consistent with the format.`;

        const response = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 1500,
            temperature: 0.7,
            messages: [{ 
                role: 'user', 
                content: prompt 
            }]
        });

        // Calculate market metrics
        const marketMetrics = {
            totalStars: analyses.reduce((acc, curr) => acc + (curr.stars || 0), 0),
            averageScore: analyses.reduce((acc, curr) => acc + (curr.analysis?.finalScore || 0), 0) / analyses.length,
            repoCount: analyses.length,
            lastUpdate: Date.now()
        };

        currentInsights = {
            analyses,
            insights: response.content[0].text,
            timestamp: Date.now(),
            meta: {
                repositoriesAnalyzed: analyses.length,
                uniqueLanguages: [...new Set(analyses.map(a => a.language))],
                averageStars: analyses.reduce((acc, curr) => acc + (curr.stars || 0), 0) / analyses.length,
                marketMetrics,
                analysisGeneration: Date.now()
            }
        };
        lastInsightUpdate = Date.now();

        io.emit('insightsUpdate', currentInsights);
        
        // Add this line to tweet the insights
        await tweetInsights(response.content[0].text);
        
        res.json(currentInsights);
    } catch (error) {
        console.error('Error in AI0x market analysis:', error);
        res.status(500).json({ 
            error: 'Market analysis interrupted',
            details: error.message 
        });
    }
});

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
        const { repoUrl } = req.body;
        if (!repoUrl) {
            return res.status(400).json({ error: 'Repository URL is required' });
        }

        console.log('Analyzing repo URL:', repoUrl);
        
        const repoInfo = extractRepoInfo(repoUrl);
        if (!repoInfo || !repoInfo.owner || !repoInfo.repo) {
            return res.status(400).json({ error: 'Invalid GitHub repository URL' });
        }

        // Add to queue
        const jobId = await queueTracker.addToQueue(`${repoInfo.owner}/${repoInfo.repo}`);
        console.log('Added to queue with jobId:', jobId);
        
        res.json({ jobId });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to analyze repository',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
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

// Add this new endpoint to get all analyses
app.get('/api/analyses', async (req, res) => {
    try {
        const analyses = await Repository.find()
            .sort({ lastAnalyzed: -1 })
            .select('fullName description language stars forks lastAnalyzed analysis');
        res.json(analyses);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analyses' });
    }
});

// Add the queue position endpoint
app.get('/api/queue-position/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const position = await queueTracker.getQueuePosition(parseInt(jobId, 10));
        res.json(position);
    } catch (error) {
        console.error('Queue position error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.use('/api', apiRouter);

initializeTwitterClient();

http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 