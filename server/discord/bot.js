const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { analyzeRepository } = require('../services/analyzer');

class DiscordBot {
    constructor() {
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.activeAnalyses = new Map();
        
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ],
            failIfNotExists: false,
            retryLimit: 5,
            presence: {
                activities: [{ name: '!repo for analysis' }]
            }
        });
        
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.on('ready', () => {
            console.log(`Discord bot logged in as ${this.client.user.tag}`);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;

            try {
                // Check for !repo or direct GitHub URL
                const githubUrl = this.extractGithubUrl(message.content);
                const isCommand = message.content.startsWith('!repo ');

                if (githubUrl || isCommand) {
                    const repoUrl = githubUrl || this.extractGithubUrl(message.content.slice(6));
                    
                    if (!repoUrl) {
                        await message.reply('Please provide a valid GitHub repository URL');
                        return;
                    }

                    await this.handleAnalysis(message, repoUrl);
                }
            } catch (error) {
                console.error('Message handling error:', error);
                await message.reply('An error occurred while processing your request.');
            }
        });

        this.client.on('error', error => {
            console.error('Discord client error:', error);
            this.reconnect();
        });
    }

    extractGithubUrl(text) {
        if (!text) return null;
        
        // Match both direct URLs and owner/repo format
        const urlMatch = text.match(
            /(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/\s]+)/
        );
        
        if (urlMatch) return urlMatch[0];

        // Try to match owner/repo format
        const repoMatch = text.match(/([^\/\s]+)\/([^\/\s]+)/);
        if (repoMatch) return `https://github.com/${repoMatch[0]}`;

        return null;
    }

    async handleAnalysis(message, repoUrl) {
        const analysisKey = `${message.guild.id}-${message.channel.id}`;
        
        if (this.activeAnalyses.has(analysisKey)) {
            await message.reply('⏳ Analysis already in progress for this channel. Please wait...');
            return;
        }

        this.activeAnalyses.set(analysisKey, true);
        const statusMsg = await message.reply('🔍 Starting analysis...');

        try {
            const result = await analyzeRepository(repoUrl);
            await this.sendAnalysisResult(message.channel, result, statusMsg);
        } catch (error) {
            console.error('Analysis error:', error);
            await statusMsg.edit(`❌ Analysis failed: ${error.message || 'Unknown error'}`);
        } finally {
            this.activeAnalyses.delete(analysisKey);
        }
    }

    async sendAnalysisResult(channel, result, statusMsg) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Analysis: ${result.fullName}`)
            .setURL(`https://github.com/${result.fullName}`)
            .addFields(
                { 
                    name: '📊 Scores',
                    value: [
                        `Legitimacy: ${result.analysis?.legitimacyScore || 0}/100`,
                        `Trust: ${result.analysis?.trustScore || 0}/100`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '📈 Stats',
                    value: [
                        `Stars: ${result.stars || 0}`,
                        `Forks: ${result.forks || 0}`,
                        `Language: ${result.language || 'Unknown'}`
                    ].join('\n'),
                    inline: true
                }
            )
            .setDescription(result.analysis?.summary || 'No summary available')
            .setFooter({ 
                text: `Risk Level: ${result.analysis?.copyDetection?.riskLevel || 'Unknown'}`
            });

        if (result.analysis?.copyDetection?.flags?.length > 0) {
            embed.addFields({
                name: '⚠️ Warnings',
                value: result.analysis.copyDetection.flags.join('\n')
            });
        }

        await statusMsg.edit({ 
            content: '✅ Analysis complete!',
            embeds: [embed]
        });
    }

    async reconnect() {
        try {
            await this.client.destroy();
            await new Promise(resolve => setTimeout(resolve, 5000));
            await this.client.login(process.env.DISCORD_TOKEN);
            console.log('Discord bot reconnected successfully');
        } catch (error) {
            console.error('Discord reconnection failed:', error);
            setTimeout(() => this.reconnect(), 10000);
        }
    }

    start() {
        this.client.login(process.env.DISCORD_TOKEN)
            .catch(error => {
                console.error('Discord login failed:', error);
                this.reconnect();
            });
    }

    setupHealthCheck() {
        setInterval(() => {
            if (!this.client.ws.shards.size) {
                console.log('No active shards, attempting reconnect...');
                this.reconnect();
            }
        }, 30000);
    }
}

const discordBot = new DiscordBot();
module.exports = discordBot; 