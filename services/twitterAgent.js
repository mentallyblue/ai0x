const { Anthropic } = require('@anthropic-ai/sdk');
const Repository = require('../models/Repository');
const { CLAUDE_TOOLS, toolFunctions } = require('./claudeTools');
const { tweetConfig, analysisFields } = require('../config/claudeConfig');
const TwitterConnector = require('./twitterConnector');
const axios = require('axios');

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1325459646386933852/d_xUWuZctYNFcHDP_W507RN-7HxGG7s74FLYUoWzn0t_-K4G-AYUz0uYce0e3pBeEp3n';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// Add strict response validation
const validateClaudeResponse = (response) => {
    if (!response?.content || !Array.isArray(response.content)) {
        throw new Error('Invalid Claude response structure: missing content array');
    }

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent?.text) {
        throw new Error('Invalid Claude response: missing text content');
    }

    const text = textContent.text.trim();
    if (!text) {
        throw new Error('Empty response from Claude');
    }

    return text;
};

class TwitterAgent {
    constructor() {
        this.tweetQueue = [];
        this.isProcessing = false;
        this.TweetHistory = null;
        this.twitterConnector = null;
        console.log('TwitterAgent initialized');
    }

    async init() {
        // Wait for the TweetHistory model to be available
        while (!global.TweetHistory) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.TweetHistory = global.TweetHistory;
        console.log('TweetHistory model initialized');

        // Initialize Twitter connector
        try {
            this.twitterConnector = new TwitterConnector({
                username: process.env.TWITTER_USERNAME,
                password: process.env.TWITTER_PASSWORD,
                email: process.env.TWITTER_EMAIL,
                proxy: process.env.PROXY_URL
            });

            const connected = await this.twitterConnector.connect();
            if (connected) {
                console.log('Twitter connection successful');
            } else {
                console.error('Failed to connect to Twitter');
            }

        } catch (error) {
            console.error('Twitter initialization error:', error);
        }

        await this.initialCheck();
    }

    async initialCheck() {
        try {
            console.log('🚀 Performing initial tweet check...');
            // Wait a few seconds for DB connection to be fully established
            await new Promise(resolve => setTimeout(resolve, 3000));
            await this.processRecentAnalyses();
        } catch (error) {
            console.error('Error in initial tweet check:', error);
        }
    }

    compressAnalysisForContext = (analysis) => {
        const { maxFeatures, maxTechStack, maxSummaryLength } = tweetConfig.compressConfig;
        
        return {
            name: analysis.fullName,
            scores: analysis.analysis.detailedScores,
            legitimacy: analysis.analysis.finalLegitimacyScore,
            aiScore: analysis.analysis.codeReview?.aiAnalysis?.score || 0,
            key_features: analysis.analysis.codeReview?.logicFlow?.slice(0, maxFeatures) || [],
            tech_stack: analysis.analysis.codeReview?.techStack?.slice(0, maxTechStack) || [],
            summary: analysis.analysis.summary?.substring(0, maxSummaryLength)
        };
    }

    async generateTweet(analyses) {
        try {
            if (!Array.isArray(analyses) || analyses.length === 0) {
                console.error('Invalid analyses input');
                return null;
            }

            console.log(`Generating tweet for ${analyses.length} analyses...`);
            
            const LINK_TEXT = " | read more: ";
            const MAX_TWEET_LENGTH = tweetConfig.maxLength - (tweetConfig.linkLength + LINK_TEXT.length);
            
            console.log(`Tweet length limit: ${MAX_TWEET_LENGTH} chars (excluding link)`);

            // Sort analyses by legitimacy score to pick the best one
            const validAnalyses = analyses
                .filter(a => a && a.fullName && a.analysis)
                .sort((a, b) => b.analysis.finalLegitimacyScore - a.analysis.finalLegitimacyScore);

            if (validAnalyses.length === 0) {
                console.error('No valid analyses to process');
                return null;
            }

            const compressedAnalysis = this.compressAnalysisForContext(validAnalyses[0]);
            
            console.log('Sending prompt to Claude...');
            
            const prompt = await this.constructPrompt(analyses, MAX_TWEET_LENGTH);
            
            let response = await anthropic.messages.create({
                model: "claude-3-sonnet-20240229",
                max_tokens: 1000,
                temperature: 0.7,
                system: `You are the ai0x Twitter account. Generate extremely concise technical tweets.
                        CRITICAL: Response must be under ${MAX_TWEET_LENGTH} characters and focus on ONE specific technical detail.`,
                messages: [{
                    role: "user",
                    content: prompt
                }]
            });

            // Track tool usage and results
            const toolResults = [];
            let toolUsageAttempts = 0;

            // Handle tool calls
            while (response.stop_reason === 'tool_calls' && toolUsageAttempts < tweetConfig.maxToolAttempts) {
                toolUsageAttempts++;
                
                for (const toolCall of response.content.filter(c => c.type === 'tool_calls')) {
                    try {
                        console.log(`🔧 Using tool: ${toolCall.tool_name}`);
                        
                        const result = await toolFunctions[toolCall.tool_name](toolCall.parameters);
                        toolResults.push({
                            tool: toolCall.tool_name,
                            result: result
                        });
                        
                        // Feed tool result back
                        response = await anthropic.messages.create({
                            model: "claude-3-sonnet-20240229",
                            max_tokens: 1000,
                            temperature: 0.7,
                            tools: CLAUDE_TOOLS,
                            messages: [
                                { 
                                    role: "user", 
                                    content: `Based on this technical context, generate a tweet about one of the repositories:
                                    
                                    Analysis Context:
                                    ${JSON.stringify(compressedAnalysis, null, 2)}
                                    
                                    Tool Results:
                                    ${JSON.stringify(toolResults, null, 2)}
                                    
                                    Requirements:
                                    1. Tweet MUST be under ${MAX_TWEET_LENGTH} characters
                                    2. MUST include repository name in owner/repo format
                                    3. Focus on specific technical implementation details
                                    4. Compare with similar implementations when relevant
                                    5. Highlight unique technical approaches
                                    6. Must be lowercase only
                                    
                                    Generate ONLY the tweet text, nothing else.`
                                }
                            ]
                        });
                    } catch (toolError) {
                        console.error(`Tool execution error (${toolCall.tool_name}):`, toolError);
                    }
                }
            }

            // Final tweet generation if needed
            if (!response.content.some(c => c.type === 'text')) {
                response = await anthropic.messages.create({
                    model: "claude-3-sonnet-20240229",
                    max_tokens: 1000,
                    temperature: 0.7,
                    messages: [
                        { 
                            role: "user", 
                            content: `Generate a final tweet based on all gathered context:
                            
                            Analysis Context:
                            ${JSON.stringify(compressedAnalysis, null, 2)}
                            
                            Tool Results:
                            ${JSON.stringify(toolResults, null, 2)}
                            
                            Requirements:
                            1. Tweet MUST be under ${MAX_TWEET_LENGTH} characters
                            2. MUST include repository name in owner/repo format
                            3. Focus on specific technical implementation details
                            4. Compare with similar implementations when relevant
                            5. Must be lowercase only
                            
                            Generate ONLY the tweet text, nothing else.`
                        }
                    ]
                });
            }

            // Validate tweet length strictly
            const tweetText = validateClaudeResponse(response);
            if (tweetText.length > MAX_TWEET_LENGTH) {
                console.error(`❌ Tweet too long: ${tweetText.length}/${MAX_TWEET_LENGTH} chars (excluding link)`);
                console.log('Generated text:', tweetText);
                return null;
            }

            if (!/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+/.test(tweetText)) {
                console.error('❌ Tweet does not contain a valid repository reference (owner/repo format)');
                return null;
            }

            // Find mentioned repos with validation
            const mentionedRepos = validAnalyses.filter(a => 
                tweetText.toLowerCase().includes(a.fullName.toLowerCase())
            );

            if (mentionedRepos.length === 0) {
                console.error('❌ Generated tweet does not clearly mention any analyzed repos');
                return null;
            }

            const mainRepo = mentionedRepos[0];
            const analysisUrl = `https://ai0x.fun/analysis.html?repo=${encodeURIComponent(mainRepo.fullName)}`;
            const finalTweet = `${tweetText}${LINK_TEXT}${analysisUrl}`;

            // Final length check including everything
            const totalLength = tweetText.length + LINK_TEXT.length + tweetConfig.linkLength;
            if (totalLength > tweetConfig.maxLength) {
                console.error(`❌ Final tweet too long with link: ${totalLength}/${tweetConfig.maxLength}`);
                return null;
            }

            return finalTweet;

        } catch (error) {
            console.error('Error in generateTweet:', error);
            return null;
        }
    }

    async sendToDiscordWebhook(tweet, analysisUrl) {
        try {
            const message = {
                embeds: [{
                    title: "New Tweet Generated",
                    description: tweet,
                    color: 0x00acee, // Twitter blue color
                    fields: [
                        {
                            name: "Analysis URL",
                            value: analysisUrl || "No URL available"
                        }
                    ],
                    footer: {
                        text: "Generated by ai0x | Click 🔄 to manually tweet"
                    },
                    timestamp: new Date().toISOString()
                }]
            };

            await axios.post(DISCORD_WEBHOOK_URL, message);
            console.log('✅ Tweet sent to Discord webhook');
        } catch (error) {
            console.error('Error sending to Discord webhook:', error);
        }
    }

    async queueTweet(text, analysisUrl) {
        try {
            if (!text) return;
            
            console.log('\n===================');
            console.log(`📝 [${new Date().toISOString()}] New Tweet Generated`);
            console.log('===================');
            console.log(text);
            console.log('===================\n');

            this.tweetQueue.push({
                text,
                timestamp: new Date()
            });

            console.log(`📊 Queue Status: ${this.tweetQueue.length} tweets pending\n`);
            console.log('📜 Recent Queue History:');
            this.tweetQueue.slice(-5).forEach((tweet, i) => {
                console.log(`${i + 1}. [${tweet.timestamp.toISOString()}] ${tweet.text.substring(0, 50)}...`);
            });

            // Send to Discord webhook as backup
            await this.sendToDiscordWebhook(text, analysisUrl);

            // Try to send via Twitter if connected
            if (this.twitterConnector && this.twitterConnector.isLoggedIn()) {
                try {
                    await this.twitterConnector.tweet(text);
                    console.log('✅ Tweet successfully posted to Twitter');
                } catch (error) {
                    console.error('Error posting to Twitter:', error);
                }
            } else {
                console.log('ℹ️ Twitter not connected - tweet sent to Discord only');
            }
        } catch (error) {
            console.error('Error queueing tweet:', error);
        }
    }

    async getRecentTweets(limit = 3) {
        try {
            return await this.TweetHistory.find()
                .sort({ timestamp: -1 })
                .limit(limit)
                .lean();
        } catch (error) {
            console.error('Error fetching recent tweets:', error);
            return [];
        }
    }

    async hasRecentlyTweeted(repoName) {
        try {
            // Check for tweets about this repo in the last 24 hours
            const recentTweet = await this.TweetHistory.findOne({
                repoName,
                timestamp: { 
                    $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) 
                }
            });

            // Also check if we've tweeted in the last hour (any repo)
            const anyRecentTweet = await this.TweetHistory.findOne({
                timestamp: {
                    $gte: new Date(Date.now() - 60 * 60 * 1000)
                }
            });

            return !!recentTweet || !!anyRecentTweet;
        } catch (error) {
            console.error('Error checking recent tweets:', error);
            return false;
        }
    }

    async saveTweetHistory(tweet, repoName, analysisIds, analysisUrl) {
        try {
            await this.TweetHistory.create({
                text: tweet,
                repoName,
                analysisIds,
                analysisUrl,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error saving tweet history:', error);
        }
    }

    constructPrompt(analyses, maxLength) {
        // Get recent tweets from DB instead of memory
        return this.getRecentTweets(3).then(recentTweets => {
            const historyContext = recentTweets.map(t => `"${t.text}"`).join('\n');
            const mainAnalysis = analyses[0];
            const analysisStr = JSON.stringify(mainAnalysis, null, 1);

            return `Generate a concise technical tweet about ONE GitHub repository.

STRICT REQUIREMENTS:
1. MUST be under ${maxLength} characters (excluding link)
2. MUST include repository name in "owner/repo" format
3. MUST be lowercase only
4. Focus on ONE specific technical implementation detail
5. Include a clear benefit or impact when possible
6. Be extremely concise and precise

STRUCTURE:
"owner/repo: specific technical achievement + impact/benefit"

GREAT EXAMPLES:
"ethereum/go-ethereum: patricia merkle trie enables 47% faster validation, reducing node sync time"
"microsoft/deepspeed: 3d parallelism cuts gpu memory by 5x, enabling larger models on smaller hardware"
"langchain/langchain: modular prompt templates reduce token usage 35%, lowering api costs"

BAD EXAMPLES:
"owner/repo: a great ai project with many features" (too vague)
"owner/repo: implements machine learning and has good documentation" (not specific)
"owner/repo: uses transformers for nlp tasks" (no impact mentioned)

ANALYSIS CONTEXT:
${analysisStr}

RECENT TWEETS (avoid similar topics):
${historyContext}

Generate ONLY the tweet text, nothing else. Focus on concrete technical achievements with measurable impact.`;
        });
    }

    async processRecentAnalyses() {
        try {
            // Check if we've tweeted in the last hour
            const lastTweet = await this.TweetHistory.findOne().sort({ timestamp: -1 });
            if (lastTweet && (Date.now() - lastTweet.timestamp.getTime()) < 60 * 60 * 1000) {
                console.log('⏳ Too soon since last tweet, skipping...');
                return;
            }

            // Get recent interesting analyses
            const recentAnalyses = await Repository.aggregate([
                {
                    $match: {
                        $or: [
                            { 'analysis.finalLegitimacyScore': { $gt: 75 } },
                            { 'analysis.codeReview.aiAnalysis.score': { $gt: 80 } }
                        ]
                    }
                },
                // Group by fullName to deduplicate
                { $group: {
                    _id: '$fullName',
                    doc: { $first: '$$ROOT' }
                }},
                { $replaceRoot: { newRoot: '$doc' } },
                { $limit: 10 }
            ]);

            // Filter out recently tweeted repos
            const validAnalyses = [];
            for (const analysis of recentAnalyses) {
                if (!(await this.hasRecentlyTweeted(analysis.fullName))) {
                    validAnalyses.push(analysis);
                }
            }

            console.log(`📊 Found ${validAnalyses.length} unique interesting analyses`);
            
            if (validAnalyses.length === 0) {
                console.log('❌ No new interesting analyses found, skipping tweet generation');
                return;
            }

            // Get repo names for logging
            const repoNames = validAnalyses.map(a => a.fullName);
            console.log('📝 Analyzing repos:', repoNames);

            // Only generate one tweet at a time
            if (this.isProcessing) {
                console.log('⏳ Already processing tweets, skipping...');
                return;
            }

            this.isProcessing = true;
            try {
                const tweet = await this.generateTweet(validAnalyses);
                if (tweet) {
                    const bestAnalysis = validAnalyses.reduce((best, current) => {
                        const currentScore = current.analysis.finalLegitimacyScore;
                        const bestScore = best.analysis.finalLegitimacyScore;
                        return currentScore > bestScore ? current : best;
                    }, validAnalyses[0]);

                    const analysisUrl = `https://ai0x.fun/analysis.html?repo=${encodeURIComponent(bestAnalysis.fullName)}`;
                    
                    await this.queueTweet(tweet, analysisUrl);
                    await this.saveTweetHistory(
                        tweet, 
                        bestAnalysis.fullName,
                        validAnalyses.map(a => a._id).filter(Boolean),
                        analysisUrl
                    );
                    console.log('✅ Tweet successfully generated and queued');
                }
            } finally {
                this.isProcessing = false;
            }
        } catch (error) {
            console.error('❌ Error in processRecentAnalyses:', error);
            this.isProcessing = false;
        }
    }
}

// Export the class instead of an initialized instance
module.exports = TwitterAgent; 