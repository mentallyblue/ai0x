const { Telegraf } = require('telegraf');
const Repository = require('../models/Repository');

// Rate limiting setup
const cooldowns = new Map();
const COOLDOWN_MINUTES = {
    'analyze': 5,
    'recent': 1,
    'insights': 2,
    'help': 0.5
};

function parseGitHubUrl(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname !== 'github.com') {
            return null;
        }
        
        const parts = urlObj.pathname.split('/').filter(p => p);
        if (parts.length < 2) {
            return null;
        }

        return {
            owner: parts[0],
            repo: parts[1]
        };
    } catch (e) {
        return null;
    }
}

function checkRateLimit(command, userId) {
    const key = `${command}:${userId}`;
    const now = Date.now();
    const cooldownAmount = COOLDOWN_MINUTES[command] * 60 * 1000;

    if (cooldowns.has(key)) {
        const expirationTime = cooldowns.get(key) + cooldownAmount;
        if (now < expirationTime) {
            return {
                limited: true,
                timeLeft: ((expirationTime - now) / 1000).toFixed(1)
            };
        }
    }

    cooldowns.set(key, now);
    setTimeout(() => cooldowns.delete(key), cooldownAmount);
    return { limited: false };
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Start command
bot.command('start', (ctx) => {
    ctx.reply(
        'Welcome to AI0x Bot! 🤖\n\n' +
        'Available commands:\n' +
        '/analyze <repo_url> - Analyze any GitHub repository\n' +
        '/recent - Show 5 most recent analyses\n' +
        '/insights - Show market health and top performers\n' +
        '/help - Show this help message'
    );
});

// Help command
bot.command('help', (ctx) => {
    ctx.reply(
        '🤖 AI0x Bot Commands:\n\n' +
        '🔍 /analyze <repo_url>\n' +
        'Analyze any GitHub repository\n\n' +
        '📊 /recent\n' +
        'Show the 5 most recent analyses\n\n' +
        '📈 /insights\n' +
        'Show market health and top performers\n\n' +
        '❓ /help\n' +
        'Show this help message'
    );
});

// Analyze command
bot.command('analyze', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const rateLimit = checkRateLimit('analyze', userId);
        if (rateLimit.limited) {
            return ctx.reply(`⏳ Please wait ${rateLimit.timeLeft} seconds before using this command again.`);
        }

        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
            return ctx.reply('Please provide a GitHub repository URL\nExample: `/analyze https://github.com/owner/repo`', { parse_mode: 'Markdown' });
        }

        const repoUrl = args[1];
        const repoInfo = parseGitHubUrl(repoUrl);

        if (!repoInfo) {
            return ctx.reply('❌ Invalid GitHub repository URL\nExample: `/analyze https://github.com/owner/repo`', { parse_mode: 'Markdown' });
        }

        const statusMsg = await ctx.reply(`🔍 Checking repository: ${repoInfo.owner}/${repoInfo.repo}...`);

        try {
            // Check for recent analysis
            const existingAnalysis = await Repository.findOne({
                owner: repoInfo.owner,
                repoName: repoInfo.repo,
                lastAnalyzed: { 
                    $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) 
                }
            });

            let result;
            
            if (existingAnalysis) {
                await ctx.telegram.editMessageText(
                    statusMsg.chat.id,
                    statusMsg.message_id,
                    null,
                    `📋 Found recent analysis for ${repoInfo.owner}/${repoInfo.repo}`
                );
                result = {
                    analysis: existingAnalysis.analysis,
                    repoDetails: {
                        fullName: `${repoInfo.owner}/${repoInfo.repo}`,
                        ...existingAnalysis
                    }
                };
            } else {
                await ctx.telegram.editMessageText(
                    statusMsg.chat.id,
                    statusMsg.message_id,
                    null,
                    `🔍 Analyzing repository: ${repoInfo.owner}/${repoInfo.repo}...`
                );
                result = await queueTracker.addToQueue(`${repoInfo.owner}/${repoInfo.repo}`);
            }

            if (!result || !result.analysis) {
                throw new Error('Analysis failed to complete');
            }

            // Format the analysis message
            const analysisText = `
*AI0x Analysis: ${repoInfo.owner}/${repoInfo.repo}*

📊 *Technical Scores*
\`\`\`
Code Quality: ${result.analysis.detailedScores.codeQuality}/25
Project Structure: ${result.analysis.detailedScores.projectStructure}/25
Implementation: ${result.analysis.detailedScores.implementation}/25
Documentation: ${result.analysis.detailedScores.documentation}/25
\`\`\`

🔍 *Analysis Metrics*
\`\`\`
Technical Score: ${result.analysis.legitimacyScore}/100
Trust Score: ${result.analysis.trustScore}/100
Final Score: ${result.analysis.finalLegitimacyScore}/100
Risk Level: ${result.analysis.codeReview.investmentRanking.rating}
\`\`\`

⚠️ *Red Flags*
${result.analysis.codeReview.redFlags.length > 0 ? 
    result.analysis.codeReview.redFlags.map(flag => `• ${flag}`).join('\n') :
    'No major red flags identified'}

🔬 *Critical Findings*
${result.analysis.codeReview.criticalPath.length > 0 ?
    result.analysis.codeReview.criticalPath.map(finding => `• ${finding}`).join('\n') :
    'No critical findings'}

🤖 *AI Implementation*
\`\`\`
Has AI: ${result.analysis.codeReview.aiAnalysis.hasAI ? 'Yes' : 'No'}
Score: ${result.analysis.codeReview.aiAnalysis.score}/100
Quality: ${result.analysis.codeReview.aiAnalysis.implementationQuality}
Risk Level: ${result.analysis.codeReview.aiAnalysis.misleadingLevel}
\`\`\`

💡 *Investment Ranking*
\`\`\`
Rating: ${result.analysis.codeReview.investmentRanking.rating}
Confidence: ${result.analysis.codeReview.investmentRanking.confidence}%
\`\`\`
${result.analysis.codeReview.investmentRanking.reasoning.map(r => `• ${r}`).join('\n')}

[View Full Analysis](https://ai0x.fun/analysis.html?repo=${repoInfo.owner}/${repoInfo.repo})`;

            await ctx.telegram.editMessageText(
                statusMsg.chat.id,
                statusMsg.message_id,
                null,
                `✅ ${existingAnalysis ? 'Cached' : 'Fresh'} analysis for ${repoInfo.owner}/${repoInfo.repo}`,
                { parse_mode: 'Markdown' }
            );

            await ctx.reply(analysisText, { 
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });

        } catch (analysisError) {
            console.error('Analysis processing error:', analysisError);
            await ctx.telegram.editMessageText(
                statusMsg.chat.id,
                statusMsg.message_id,
                null,
                `❌ Failed to analyze repository ${repoInfo.owner}/${repoInfo.repo}. Make sure the repository exists and is public.`
            );
        }

    } catch (error) {
        console.error('Command error:', error);
        ctx.reply('❌ Failed to process command. Please make sure you\'re using a valid GitHub URL\nExample: `/analyze https://github.com/owner/repo`', { parse_mode: 'Markdown' });
    }
});

// Recent command
bot.command('recent', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const rateLimit = checkRateLimit('recent', userId);
        if (rateLimit.limited) {
            return ctx.reply(`⏳ Please wait ${rateLimit.timeLeft} seconds before using this command again.`);
        }

        const analyses = await Repository.find()
            .select({
                fullName: 1,
                language: 1,
                stars: 1,
                'analysis.detailedScores': 1,
                'analysis.legitimacyScore': 1,
                'analysis.trustScore': 1,
                'analysis.finalLegitimacyScore': 1,
                'analysis.codeReview': 1,
                lastAnalyzed: 1
            })
            .sort({ lastAnalyzed: -1 })
            .limit(5);

        const recentText = `
*Recent AI0x Analyses*

${analyses.map(repo => `
📊 *${repo.fullName}*
\`\`\`
Technical Score: ${repo.analysis?.legitimacyScore || 'N/A'}/100
Trust Score: ${repo.analysis?.trustScore || 'N/A'}/100
Final Score: ${repo.analysis?.finalLegitimacyScore || 'N/A'}/100
Risk Level: ${repo.analysis?.codeReview?.investmentRanking?.rating || 'N/A'}
Stars: ${repo.stars || 0}
\`\`\`
${repo.analysis?.codeReview?.redFlags?.length ? 
    '⚠️ Red Flags:\n' + repo.analysis.codeReview.redFlags.map(flag => `• ${flag}`).join('\n') : 
    'No red flags identified'}
[View Analysis](https://ai0x.fun/analysis.html?repo=${repo.fullName})
`).join('\n')}`;

        await ctx.reply(recentText, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });

    } catch (error) {
        console.error('Recent analyses error:', error);
        ctx.reply('❌ Failed to fetch recent analyses');
    }
});

// Error handling
bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
    ctx.reply('❌ An error occurred while processing your request. Please try again later.');
});

const startBot = async () => {
    try {
        // Only start bot if not in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Skipping Telegram bot in development mode');
            return;
        }

        // Start the bot
        await bot.launch({
            dropPendingUpdates: true
        });
        
        console.log('Telegram bot started successfully');

        // Enable graceful shutdown
        process.once('SIGINT', () => {
            console.log('Stopping Telegram bot (SIGINT)');
            bot.stop('SIGINT');
        });
        process.once('SIGTERM', () => {
            console.log('Stopping Telegram bot (SIGTERM)');
            bot.stop('SIGTERM');
        });

    } catch (error) {
        console.error('Error starting Telegram bot:', error);
        throw error;
    }
};

module.exports = {
    startBot,
    bot
}; 