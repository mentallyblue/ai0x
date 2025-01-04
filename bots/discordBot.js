const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
const { queueTracker } = require('../services/queueService');
const Repository = require('../models/Repository');

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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const cooldowns = new Collection();
const COOLDOWN_MINUTES = {
    'analyze': 5,    // 5 min cooldown for analysis
    'recent': 1,     // 1 min for recent
    'insights': 2,   // 2 min for insights
    'help': 0.5      // 30 sec for help
};

function checkRateLimit(command, userId) {
    if (!cooldowns.has(command)) {
        cooldowns.set(command, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command);
    const cooldownAmount = COOLDOWN_MINUTES[command] * 60 * 1000;

    if (timestamps.has(userId)) {
        const expirationTime = timestamps.get(userId) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return {
                limited: true,
                timeLeft: timeLeft.toFixed(1)
            };
        }
    }

    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownAmount);
    return { limited: false };
}

// Format scores for display
const formatScores = (scores) => {
    return Object.entries(scores || {})
        .map(([key, value]) => `${key}: ${value}/100`)
        .join('\n');
};

const commands = {
    '!analyze': async (message, args) => {
        try {
            if (!args[0]) {
                return message.reply('Please provide a GitHub repository URL\nExample: `!analyze https://github.com/owner/repo`');
            }

            const repoUrl = args[0];
            const repoInfo = parseGitHubUrl(repoUrl);

            if (!repoInfo) {
                return message.reply('❌ Invalid GitHub repository URL\nExample: `!analyze https://github.com/owner/repo`');
            }

            const statusMsg = await message.reply(`🔍 Checking repository: ${repoInfo.owner}/${repoInfo.repo}...`);
            
            try {
                // Check if we have a recent analysis (less than 24 hours old)
                const existingAnalysis = await Repository.findOne({
                    owner: repoInfo.owner,
                    repoName: repoInfo.repo,
                    lastAnalyzed: { 
                        $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) 
                    }
                });

                let result;
                
                if (existingAnalysis) {
                    // Use cached analysis
                    await statusMsg.edit(`📋 Found recent analysis for ${repoInfo.owner}/${repoInfo.repo}`);
                    result = {
                        analysis: existingAnalysis.analysis,
                        repoDetails: {
                            fullName: `${repoInfo.owner}/${repoInfo.repo}`,
                            ...existingAnalysis
                        }
                    };
                } else {
                    // Perform new analysis
                    await statusMsg.edit(`🔍 Analyzing repository: ${repoInfo.owner}/${repoInfo.repo}...`);
                    result = await queueTracker.addToQueue(`${repoInfo.owner}/${repoInfo.repo}`);
                }

                if (!result || !result.analysis) {
                    throw new Error('Analysis failed to complete');
                }

                const analysisEmbed = new EmbedBuilder()
                    .setTitle(`AI0x Analysis: ${repoInfo.owner}/${repoInfo.repo}`)
                    .setColor('#00ff00')
                    .setURL(`https://ai0x.fun/analysis.html?repo=${repoInfo.owner}/${repoInfo.repo}`)
                    .addFields([
                        {
                            name: '📊 Technical Scores',
                            value: `\`\`\`
Code Quality: ${result.analysis.detailedScores.codeQuality}/25
Project Structure: ${result.analysis.detailedScores.projectStructure}/25
Implementation: ${result.analysis.detailedScores.implementation}/25
Documentation: ${result.analysis.detailedScores.documentation}/25\`\`\``,
                            inline: false
                        },
                        {
                            name: '🔍 Analysis Metrics',
                            value: `\`\`\`
Technical Score: ${result.analysis.legitimacyScore}/100
Trust Score: ${result.analysis.trustScore}/100
Final Score: ${result.analysis.finalLegitimacyScore}/100
Risk Level: ${result.analysis.codeReview.investmentRanking.rating}\`\`\``,
                            inline: false
                        },
                        {
                            name: '⚠️ Red Flags',
                            value: result.analysis.codeReview.redFlags.length > 0 ? 
                                result.analysis.codeReview.redFlags.map(flag => `• ${flag}`).join('\n') :
                                'No major red flags identified',
                            inline: false
                        },
                        {
                            name: '🔬 Critical Findings',
                            value: result.analysis.codeReview.criticalPath.length > 0 ?
                                result.analysis.codeReview.criticalPath.map(finding => `• ${finding}`).join('\n') :
                                'No critical findings',
                            inline: false
                        },
                        {
                            name: '🤖 AI Implementation',
                            value: `\`\`\`
Has AI: ${result.analysis.codeReview.aiAnalysis.hasAI ? 'Yes' : 'No'}
Score: ${result.analysis.codeReview.aiAnalysis.score}/100
Quality: ${result.analysis.codeReview.aiAnalysis.implementationQuality}
Risk Level: ${result.analysis.codeReview.aiAnalysis.misleadingLevel}\`\`\``,
                            inline: false
                        },
                        {
                            name: '💡 Investment Ranking',
                            value: `\`\`\`
Rating: ${result.analysis.codeReview.investmentRanking.rating}
Confidence: ${result.analysis.codeReview.investmentRanking.confidence}%\`\`\`
${result.analysis.codeReview.investmentRanking.reasoning.map(r => `• ${r}`).join('\n')}`,
                            inline: false
                        }
                    ])
                    .setFooter({ 
                        text: 'Click the button below to view the full analysis' 
                    });

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('View Full Analysis')
                            .setStyle(ButtonStyle.Link)
                            .setURL(`https://ai0x.fun/analysis.html?repo=${repoInfo.owner}/${repoInfo.repo}`)
                    );

                await statusMsg.edit({ 
                    content: `✅ ${existingAnalysis ? 'Cached' : 'Fresh'} analysis for ${repoInfo.owner}/${repoInfo.repo}`,
                    embeds: [analysisEmbed],
                    components: [row]
                });

            } catch (analysisError) {
                console.error('Analysis processing error:', analysisError);
                await statusMsg.edit(`❌ Failed to analyze repository ${repoInfo.owner}/${repoInfo.repo}. Make sure the repository exists and is public.`);
            }

        } catch (error) {
            console.error('Command error:', error);
            message.reply('❌ Failed to process command. Please make sure you\'re using a valid GitHub URL\nExample: `!analyze https://github.com/owner/repo`');
        }
    },

    '!recent': async (message) => {
        try {
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

            const embed = new EmbedBuilder()
                .setTitle('Recent AI0x Analyses')
                .setColor('#0099ff')
                .setDescription('Latest repository analyses:')
                .addFields(
                    analyses.map(repo => ({
                        name: `📊 ${repo.fullName}`,
                        value: `\`\`\`
Technical Score: ${repo.analysis?.legitimacyScore || 'N/A'}/100
Trust Score: ${repo.analysis?.trustScore || 'N/A'}/100
Final Score: ${repo.analysis?.finalLegitimacyScore || 'N/A'}/100
Risk Level: ${repo.analysis?.codeReview?.investmentRanking?.rating || 'N/A'}
Stars: ${repo.stars || 0}\`\`\`
${repo.analysis?.codeReview?.redFlags?.length ? '⚠️ Red Flags:\n' + 
    repo.analysis.codeReview.redFlags.map(flag => `• ${flag}`).join('\n') : 'No red flags identified'}`,
                        inline: false
                    }))
                )
                .setTimestamp()
                .setFooter({ text: 'AI0x Recent Analyses' });

            // Create buttons for each analysis
            const rows = analyses.map(repo => 
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel(`View ${repo.fullName} Analysis`)
                            .setStyle(ButtonStyle.Link)
                            .setURL(`https://ai0x.fun/analysis.html?repo=${repo.fullName}`)
                    )
            );

            message.reply({ 
                embeds: [embed],
                components: rows
            });

        } catch (error) {
            console.error('Recent analyses error:', error);
            message.reply('❌ Failed to fetch recent analyses');
        }
    },

    '!insights': async (message) => {
        try {
            const analyses = await Repository.find()
                .sort({ 'analysis.finalLegitimacyScore': -1 })
                .limit(10);

            const avgScore = analyses.reduce((acc, repo) => 
                acc + (repo.analysis?.finalLegitimacyScore || 0), 0) / analyses.length;

            const topPerformers = analyses
                .filter(repo => repo.analysis?.finalLegitimacyScore > 75)
                .slice(0, 3);

            const embed = new EmbedBuilder()
                .setTitle('AI0x Market Insights')
                .setColor('#ff9900')
                .addFields([
                    {
                        name: '🌍 Market Overview',
                        value: `Health Score: ${Math.round(avgScore)}/100\n` +
                               `Active Projects: ${analyses.length}\n` +
                               `Top Language: ${getMostCommonLanguage(analyses)}`
                    },
                    {
                        name: '🏆 Top Performers',
                        value: topPerformers.map(repo => 
                            `**${repo.fullName}**\n` +
                            `Score: ${repo.analysis?.finalLegitimacyScore}/100\n` +
                            `${repo.analysis?.summary?.slice(0, 100)}...`
                        ).join('\n\n') || 'No top performers found'
                    },
                    {
                        name: '📈 Trends',
                        value: generateTrends(analyses)
                    }
                ])
                .setTimestamp()
                .setFooter({ text: 'AI0x Market Intelligence' });

            message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Insights error:', error);
            message.reply('❌ Failed to fetch market insights');
        }
    },

    '!help': (message) => {
        const embed = new EmbedBuilder()
            .setTitle('AI0x Bot Commands')
            .setColor('#ff00ff')
            .addFields([
                {
                    name: '🔍 Analysis',
                    value: '`!analyze <repo_url>` - Analyze any GitHub repository'
                },
                {
                    name: '📊 Recent',
                    value: '`!recent` - Show the 5 most recent analyses'
                },
                {
                    name: '📈 Insights',
                    value: '`!insights` - Show market health and top performers'
                },
                {
                    name: '❓ Help',
                    value: '`!help` - Show this help message'
                }
            ])
            .setFooter({ text: 'AI0x - AI-Powered Market Intelligence' });

        message.reply({ embeds: [embed] });
    }
};

// Helper functions
function getMostCommonLanguage(analyses) {
    const langs = analyses.map(r => r.language).filter(Boolean);
    return langs.length ? 
        langs.sort((a,b) => 
            langs.filter(v => v === a).length - langs.filter(v => v === b).length
        ).pop() : 'Unknown';
}

function generateTrends(analyses) {
    const recentScores = analyses.slice(-5).map(r => r.analysis?.finalLegitimacyScore || 0);
    const avgRecent = recentScores.reduce((a,b) => a + b, 0) / recentScores.length;
    const trend = avgRecent > 75 ? 'Bullish 📈' : avgRecent > 50 ? 'Neutral ↔️' : 'Bearish 📉';
    return `Market Trend: ${trend}\nAverage Score: ${Math.round(avgRecent)}/100`;
}

// Helper function to calculate grade
function getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 55) return 'C';
    if (score >= 50) return 'C-';
    return 'D';
}

client.on('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    
    // Generate and log invite link
    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=274878221312&scope=bot%20applications.commands`;
    console.log(`Invite Link: ${inviteLink}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args.shift().toLowerCase();
    const commandName = command.slice(1); // Remove the ! prefix

    if (commands[command]) {
        // Check rate limit
        const rateLimit = checkRateLimit(commandName, message.author.id);
        if (rateLimit.limited) {
            return message.reply(`⏳ Please wait ${rateLimit.timeLeft} seconds before using this command again.`);
        }

        // Execute command if not rate limited
        await commands[command](message, args);
    }
});

const startBot = () => {
    client.login(process.env.DISCORD_TOKEN);
};

module.exports = { startBot }; 