const { analyzeRepo } = require('./analyzer');

class QueueService {
    constructor() {
        this.queue = new Map();
        this.processing = new Set();
        this.results = new Map();
        this.lastJobId = 0;
    }

    async addToQueue(repoUrl) {
        const jobId = ++this.lastJobId;
        this.queue.set(jobId, {
            repoUrl,
            status: 'queued',
            timestamp: Date.now()
        });
        
        // Emit queue update via Socket.IO if available
        if (global.io) {
            global.io.emit('queueUpdate', {
                size: this.queue.size,
                processing: this.processing.size
            });
        }

        return jobId;
    }

    async getQueuePosition(jobId) {
        const job = this.queue.get(parseInt(jobId));
        
        if (!job) {
            if (this.results.has(parseInt(jobId))) {
                const result = this.results.get(parseInt(jobId));
                return {
                    status: 'completed',
                    result
                };
            }
            throw new Error('Job not found');
        }

        const position = Array.from(this.queue.keys()).indexOf(parseInt(jobId));
        const total = this.queue.size;

        return {
            status: job.status,
            position,
            total
        };
    }
}

module.exports = { QueueService }; 