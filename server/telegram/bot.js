const TelegramBot = require('node-telegram-bot-api');
const { Analysis } = require('../models/Analysis');
const { analyzeRepository } = require('../services/analyzer');
const { Connection, PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');

class TelegramBotService {
    constructor() {
        this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000; // Start with 5 seconds
        this.setupErrorHandling();
        this.setupCommands();
        this.activeAnalyses = new Map(); // Track ongoing analyses
        this.messageQueue = new Map();
        this.MESSAGE_DELAY = 1000; // 1 second between messages
        this.setupRateLimiting();
        this.connection = new Connection(process.env.SOLANA_RPC_URL);
        this.tokenMint = new PublicKey(process.env.TOKEN_MINT_ADDRESS);
        this.userRequests = new Map(); // Track monthly requests
        this.userWallets = new Map();  // Store user wallet associations
        
        // Reset monthly requests
        setInterval(() => this.resetMonthlyRequests(), 30 * 24 * 60 * 60 * 1000);
    }

    setupErrorHandling() {
        // Handle polling errors
        this.bot.on('polling_error', (error) => {
            console.error('Telegram polling error:', error);
            this.handleReconnect();
        });

        // Handle webhook errors
        this.bot.on('webhook_error', (error) => {
            console.error('Telegram webhook error:', error);
            this.handleReconnect();
        });

        // Handle general errors
        this.bot.on('error', (error) => {
            console.error('Telegram bot error:', error);
            this.handleReconnect();
        });

        // Health check interval
        setInterval(() => this.performHealthCheck(), 60000); // Every minute
    }

    async handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached. Manual intervention needed.');
            // Send alert to admin (implement your notification method)
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

        console.log(`Attempting to reconnect in ${delay/1000} seconds...`);
        
        setTimeout(async () => {
            try {
                await this.bot.stopPolling();
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.bot.startPolling();
                console.log('Successfully reconnected!');
                this.reconnectAttempts = 0;
            } catch (error) {
                console.error('Reconnection failed:', error);
                this.handleReconnect();
            }
        }, delay);
    }

    async performHealthCheck() {
        try {
            const botInfo = await this.bot.getMe();
            if (!botInfo) {
                throw new Error('Bot health check failed');
            }
            // Reset reconnect attempts on successful health check
            this.reconnectAttempts = 0;
        } catch (error) {
            console.error('Health check failed:', error);
            this.handleReconnect();
        }
    }

    setupCommands() {
        // Start command
        this.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            this.bot.sendMessage(chatId, 
                'Welcome to AI0x Analysis Bot! 🤖\n\n' +
                'Send me a GitHub repository URL to analyze it.\n' +
                'Example: https://github.com/username/repo\n\n' +
                'Commands:\n' +
                '/analyze <repo-url> - Analyze a repository\n' +
                '/recent - Show recent analyses\n' +
                '/help - Show this help message'
            );
        });

        // Help command
        this.bot.onText(/\/help/, (msg) => {
            const chatId = msg.chat.id;
            this.bot.sendMessage(chatId,
                'AI0x Bot Commands:\n\n' +
                '🔍 /analyze <repo-url> - Analyze a repository\n' +
                '📜 /recent - Show recent analyses\n' +
                '❓ /help - Show this help message\n\n' +
                'You can also simply send a GitHub URL to analyze it!'
            );
        });

        // Recent analyses command
        this.bot.onText(/\/recent/, async (msg) => {
            try {
                const chatId = msg.chat.id;
                const analyses = await Analysis.find()
                    .sort({ lastAnalyzed: -1 })
                    .limit(5)
                    .lean();

                if (!analyses.length) {
                    return this.bot.sendMessage(chatId, 'No recent analyses found.');
                }

                const message = analyses.map(a => 
                    `📊 ${a.fullName}\n` +
                    `Score: ${a.analysis?.legitimacyScore || 0}/100\n` +
                    `Language: ${a.language || 'Unknown'}\n`
                ).join('\n');

                await this.bot.sendMessage(chatId, 
                    '🕒 Recent Analyses:\n\n' + message,
                    { parse_mode: 'HTML' }
                );
            } catch (error) {
                this.handleError(msg.chat.id, error);
            }
        });

        // Handle repository URLs and analyze command
        this.bot.on('message', async (msg) => {
            try {
                const chatId = msg.chat.id;
                const text = msg.text;

                // Skip if it's a command we've already handled
                if (text.startsWith('/') && !text.startsWith('/analyze')) return;

                const githubUrl = this.extractGithubUrl(text);
                if (!githubUrl) return;

                // Check if analysis is already in progress
                if (this.activeAnalyses.has(chatId)) {
                    return this.bot.sendMessage(chatId, 
                        '⏳ Analysis already in progress. Please wait...'
                    );
                }

                await this.handleAnalysis(chatId, githubUrl);
            } catch (error) {
                this.handleError(msg.chat.id, error);
            }
        });

        // Add wallet command
        this.bot.onText(/\/wallet (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const walletAddress = match[1];
            
            try {
                if (!PublicKey.isOnCurve(walletAddress)) {
                    return this.sendQueuedMessage(chatId, '❌ Invalid Solana wallet address');
                }

                this.userWallets.set(chatId, walletAddress);
                await this.checkUserAccess(chatId);
                
            } catch (error) {
                this.handleError(chatId, error);
            }
        });
    }

    extractGithubUrl(text) {
        const urlMatch = text.match(
            /(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/\s]+)/
        );
        return urlMatch ? urlMatch[0] : null;
    }

    async handleAnalysis(chatId, repoUrl) {
        // Check access before processing
        if (!await this.checkUserAccess(chatId)) {
            return;
        }

        // Increment request count for free tier
        if (!this.hasUnlimitedAccess(chatId)) {
            const currentRequests = this.userRequests.get(chatId) || 0;
            this.userRequests.set(chatId, currentRequests + 1);
        }

        try {
            this.activeAnalyses.set(chatId, true);
            
            const statusMessage = await this.bot.sendMessage(chatId, 
                '🔍 Starting analysis...'
            );

            // Update status periodically
            const updateInterval = setInterval(() => {
                this.bot.editMessageText(
                    '🔍 Analysis in progress...\nThis may take a few minutes.',
                    {
                        chat_id: chatId,
                        message_id: statusMessage.message_id
                    }
                ).catch(() => {}); // Ignore errors from rate limiting
            }, 5000);

            const result = await analyzeRepository(repoUrl);

            clearInterval(updateInterval);

            // Format and send results
            const analysis = result.analysis;
            const message = this.formatAnalysisResult(result);

            await this.bot.editMessageText(message, {
                chat_id: chatId,
                message_id: statusMessage.message_id,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });

        } catch (error) {
            this.handleError(chatId, error);
        } finally {
            this.activeAnalyses.delete(chatId);
        }
    }

    formatAnalysisResult(result) {
        return `
🎯 Analysis Complete!

Repository: <a href="${result.repoUrl}">${result.fullName}</a>
Language: ${result.language || 'Unknown'}
Stars: ${result.stars || 0} | Forks: ${result.forks || 0}

📊 Scores:
• Legitimacy: ${result.analysis?.legitimacyScore || 0}/100
• Trust: ${result.analysis?.trustScore || 0}/100

🔍 Key Findings:
${result.analysis?.summary || 'No summary available.'}

⚠️ Risk Level: ${result.analysis?.copyDetection?.riskLevel || 'Unknown'}

View full analysis: ${process.env.SITE_URL}/analysis?repo=${result.fullName}
`;
    }

    handleError(chatId, error) {
        console.error('Bot error:', error);
        this.bot.sendMessage(chatId,
            '❌ Error: ' + (error.message || 'An unknown error occurred.') +
            '\nPlease try again later.'
        ).catch(console.error);
    }

    setupRateLimiting() {
        setInterval(() => {
            this.messageQueue.forEach((message, chatId) => {
                if (message && Date.now() - message.timestamp > this.MESSAGE_DELAY) {
                    this.bot.sendMessage(chatId, message.text)
                        .catch(error => console.error('Message send error:', error));
                    this.messageQueue.delete(chatId);
                }
            });
        }, 500);
    }

    async sendQueuedMessage(chatId, text) {
        this.messageQueue.set(chatId, {
            text,
            timestamp: Date.now()
        });
    }

    async checkUserAccess(chatId) {
        try {
            const walletAddress = this.userWallets.get(chatId);
            if (!walletAddress) {
                await this.sendQueuedMessage(chatId, 
                    '❌ Please set your wallet first:\n' +
                    '/wallet YOUR_SOLANA_WALLET\n\n' +
                    '🎫 Token required: $PUMP\n' +
                    `💰 Buy here: ${process.env.TOKEN_PURCHASE_URL}`
                );
                return false;
            }

            try {
                const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                    new PublicKey(walletAddress),
                    { programId: TOKEN_PROGRAM_ID }
                );

                const ourTokenAccount = tokenAccounts.value.find(
                    account => account.account.data.parsed.info.mint === this.tokenMint.toString()
                );

                if (!ourTokenAccount) {
                    await this.sendQueuedMessage(chatId,
                        '❌ No $PUMP tokens found in your wallet!\n\n' +
                        '💡 You need $PUMP tokens for unlimited access.\n' +
                        `🛍️ Buy here: ${process.env.TOKEN_PURCHASE_URL}\n\n` +
                        '📊 Free tier: 1000 requests/month remaining'
                    );
                    return this.checkMonthlyLimit(chatId);
                }

                const balance = ourTokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
                
                if (balance >= process.env.REQUIRED_TOKEN_AMOUNT) {
                    await this.sendQueuedMessage(chatId,
                        '✅ Premium access activated!\n' +
                        `💰 Balance: ${balance} $PUMP\n` +
                        '🚀 Unlimited requests available'
                    );
                    return true;
                }

                await this.sendQueuedMessage(chatId,
                    `❌ Insufficient $PUMP balance (${balance}/${process.env.REQUIRED_TOKEN_AMOUNT})\n\n` +
                    `🛍️ Get more here: ${process.env.TOKEN_PURCHASE_URL}\n\n` +
                    '📊 Using free tier (1000 requests/month)'
                );
                return this.checkMonthlyLimit(chatId);

            } catch (error) {
                console.error('Token check error:', error);
                return this.checkMonthlyLimit(chatId);
            }
        } catch (error) {
            console.error('Access check error:', error);
            return false;
        }
    }

    async checkMonthlyLimit(chatId) {
        const monthlyRequests = this.userRequests.get(chatId) || 0;
        if (monthlyRequests >= 1000) {
            await this.sendQueuedMessage(chatId,
                '❌ Monthly request limit reached!\n\n' +
                '💡 Get unlimited access with $PUMP tokens\n' +
                `🛍️ Buy here: ${process.env.TOKEN_PURCHASE_URL}\n\n` +
                '⏳ Free tier resets in: ' + this.getTimeUntilReset()
            );
            return false;
        }
        return true;
    }

    getTimeUntilReset() {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const diff = nextMonth - now;
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        return `${days}d ${hours}h`;
    }

    async hasUnlimitedAccess(chatId) {
        const walletAddress = this.userWallets.get(chatId);
        if (!walletAddress) return false;

        try {
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                new PublicKey(walletAddress),
                { programId: TOKEN_PROGRAM_ID }
            );

            const ourTokenAccount = tokenAccounts.value.find(
                account => account.account.data.parsed.info.mint === this.tokenMint.toString()
            );

            if (!ourTokenAccount) return false;

            const balance = ourTokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
            return balance >= process.env.REQUIRED_TOKEN_AMOUNT;
        } catch {
            return false;
        }
    }

    resetMonthlyRequests() {
        this.userRequests.clear();
        console.log('Monthly request counts reset');
    }
}

// Export singleton instance
const botService = new TelegramBotService();
module.exports = botService; 