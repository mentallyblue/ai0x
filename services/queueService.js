// In-memory queue implementation
class InMemoryQueue {
    constructor() {
        this.queue = [];
        this.active = null;
        this.jobCounter = 0;
        this.jobResults = new Map(); // Store job results
        this.processQueue(); // Start processing
        this.broadcastQueueSize();
    }

    broadcastQueueSize() {
        const size = this.queue.length + (this.active ? 1 : 0);
        if (global.io) {
            global.io.emit('queueUpdate', { size });
        }
    }

    async add(data) {
        const jobId = ++this.jobCounter;
        this.queue.push({
            id: jobId,
            data,
            status: 'waiting',
            addedAt: Date.now()
        });
        this.broadcastQueueSize();
        return jobId;
    }

    async getPosition(jobId) {
        // Check if job is completed
        if (this.jobResults.has(jobId)) {
            return {
                position: 0,
                total: this.queue.length + (this.active ? 1 : 0),
                status: 'completed',
                result: this.jobResults.get(jobId)
            };
        }

        // Check if job is active
        if (this.active && this.active.id === jobId) {
            return {
                position: 0,
                total: this.queue.length + 1,
                status: 'processing'
            };
        }

        // Find position in queue
        const position = this.queue.findIndex(job => job.id === jobId);
        if (position === -1) {
            return {
                position: -1,
                total: this.queue.length + (this.active ? 1 : 0),
                status: 'not_found'
            };
        }

        return {
            position: position + 1,
            total: this.queue.length + (this.active ? 1 : 0),
            status: 'waiting'
        };
    }

    async processQueue() {
        while (true) {
            if (this.active || this.queue.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            this.active = this.queue.shift();
            try {
                // Process the job
                const result = await this.processJob(this.active.data);
                this.jobResults.set(this.active.id, result);

                // Clean up old results (keep for 1 hour)
                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                for (const [jobId, result] of this.jobResults) {
                    if (result.timestamp < oneHourAgo) {
                        this.jobResults.delete(jobId);
                    }
                }
            } catch (error) {
                console.error('Job processing error:', error);
                this.jobResults.set(this.active.id, { error: error.message, status: 'failed' });
            }
            this.active = null;
        }
    }

    async processJob(data) {
        try {
            const { analyzeRepo } = require('./analyzer');
            const [owner, repo] = data.repoFullName.split('/');
            const result = await analyzeRepo({ owner, repo });
            return {
                ...result,
                timestamp: Date.now(),
                status: 'completed'
            };
        } catch (error) {
            console.error('Job processing error:', error);
            return {
                error: error.message,
                timestamp: Date.now(),
                status: 'failed'
            };
        }
    }
}

// Create singleton instance
const queueInstance = new InMemoryQueue();

// Export queue interface
const queueTracker = {
    async addToQueue(repoFullName) {
        return queueInstance.add({ repoFullName });
    },

    async getQueuePosition(jobId) {
        return queueInstance.getPosition(jobId);
    }
};

module.exports = {
    queueTracker
}; 