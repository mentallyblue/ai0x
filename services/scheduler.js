const cron = require('node-cron');
const TwitterAgent = require('./twitterAgent');

class Scheduler {
    constructor() {
        this.twitterAgent = null;
        this.init();
    }

    async init() {
        // Initialize TwitterAgent
        this.twitterAgent = new TwitterAgent();
        await this.twitterAgent.init();
        
        // Run immediately on startup
        await this.generateTweets();
        
        // Run every hour in both dev and prod
        console.log('🕒 Scheduling tweet generation every hour');
        cron.schedule('0 * * * *', () => {
            this.generateTweets();
        });
    }

    async generateTweets() {
        try {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] Generating tweets...`);
            await this.twitterAgent.processRecentAnalyses();
        } catch (error) {
            console.error('Error in tweet generation schedule:', error);
        }
    }
}

module.exports = Scheduler; 