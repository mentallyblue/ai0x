const { analyzeRepo } = require('./analyzer');

const queueTracker = {
    async addToQueue(repoFullName) {
        // Directly analyze without queueing
        const [owner, repo] = repoFullName.split('/');
        const result = await analyzeRepo({ owner, repo });
        
        // Notify via WebSocket
        global.io?.emit('analysisComplete', {
            repo: repoFullName,
            result: result
        });

        return result;
    },

    async getQueuePosition() {
        // Always return completed since there's no queue
        return {
            position: 0,
            total: 0,
            status: 'completed'
        };
    },

    getQueueStats() {
        // Always return empty stats
        return {
            waiting: 0,
            processing: 0,
            total: 0
        };
    },

    trackAnalysis() {
        // No-op since we're not tracking anything
        return true;
    }
};

module.exports = { queueTracker }; 