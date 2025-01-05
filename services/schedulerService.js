const cron = require('node-cron');
const Repository = require('../models/Repository');
const insightsService = require('./insightsService');

class SchedulerService {
    start() {
        // Run every hour
        cron.schedule('0 * * * *', async () => {
            try {
                console.log('Running scheduled insights update...');
                
                // Get repositories that need updates
                const repos = await Repository.find({
                    $or: [
                        { lastInsightUpdate: { $lt: new Date(Date.now() - 3600000) } }, // Older than 1 hour
                        { lastInsightUpdate: { $exists: false } }
                    ]
                });

                for (const repo of repos) {
                    try {
                        await insightsService.generateInsights(repo.fullName);
                    } catch (error) {
                        console.error(`Error processing repo ${repo.fullName}:`, error);
                    }
                }
            } catch (error) {
                console.error('Scheduler error:', error);
            }
        });
    }
}

module.exports = new SchedulerService(); 