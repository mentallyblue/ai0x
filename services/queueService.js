const config = require('../config/config');
const EventEmitter = require('events');

class InMemoryQueue extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.active = null;
        this.jobCounter = 0;
        this.jobResults = new Map();
        this.jobRetries = new Map();
        this.isProcessing = false;
        
        // Start queue processing and cleanup
        this.startProcessing();
        this.startCleanup();
    }

    startProcessing() {
        if (!this.isProcessing) {
            this.isProcessing = true;
            this.processQueue();
        }
    }

    async add(data) {
        // Check queue size limit
        if (this.queue.length >= config.QUEUE_CONFIG.maxQueueSize) {
            throw new Error('Queue is full');
        }

        const jobId = ++this.jobCounter;
        const job = {
            id: jobId,
            data,
            status: 'waiting',
            addedAt: Date.now(),
            timeout: setTimeout(() => this.handleJobTimeout(jobId), 
                              config.QUEUE_CONFIG.jobTimeout)
        };

        this.queue.push(job);
        this.broadcastQueueSize();
        
        return jobId;
    }

    handleJobTimeout(jobId) {
        const job = this.active?.id === jobId ? this.active : 
                   this.queue.find(j => j.id === jobId);
        
        if (job) {
            this.handleJobFailure(job, new Error('Job timeout'));
        }
    }

    async handleJobFailure(job, error) {
        const retries = this.jobRetries.get(job.id) || 0;
        
        if (retries < config.QUEUE_CONFIG.maxRetries) {
            // Retry the job
            this.jobRetries.set(job.id, retries + 1);
            setTimeout(() => {
                this.queue.push({
                    ...job,
                    status: 'waiting',
                    addedAt: Date.now()
                });
                this.broadcastQueueSize();
            }, config.QUEUE_CONFIG.retryDelay);
        } else {
            // Mark as failed after max retries
            this.jobResults.set(job.id, {
                error: error.message,
                timestamp: Date.now(),
                status: 'failed',
                retries
            });
        }
    }

    async processQueue() {
        while (this.isProcessing) {
            if (this.active || this.queue.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            this.active = this.queue.shift();
            this.broadcastQueueSize();

            try {
                clearTimeout(this.active.timeout);
                const result = await this.processJob(this.active.data);
                this.jobResults.set(this.active.id, {
                    ...result,
                    timestamp: Date.now(),
                    status: 'completed'
                });
            } catch (error) {
                console.error('Job processing error:', error);
                await this.handleJobFailure(this.active, error);
            } finally {
                this.active = null;
                this.broadcastQueueSize();
            }
        }
    }

    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            
            // Clean up old results
            for (const [jobId, result] of this.jobResults) {
                if (now - result.timestamp > config.QUEUE_CONFIG.resultsTTL) {
                    this.jobResults.delete(jobId);
                }
            }

            // Clean up retry counters for completed jobs
            for (const [jobId] of this.jobRetries) {
                if (this.jobResults.has(jobId)) {
                    this.jobRetries.delete(jobId);
                }
            }
        }, config.QUEUE_CONFIG.cleanupInterval);
    }

    broadcastQueueSize() {
        const size = this.queue.length + (this.active ? 1 : 0);
        if (global.io) {
            global.io.emit('queueUpdate', { size });
        }
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
        try {
            return await queueInstance.add({ repoFullName });
        } catch (error) {
            console.error('Failed to add to queue:', error);
            throw new Error('Queue is currently full. Please try again later.');
        }
    },

    async getQueuePosition(jobId) {
        try {
            return await queueInstance.getPosition(jobId);
        } catch (error) {
            console.error('Failed to get queue position:', error);
            throw new Error('Failed to get job status');
        }
    },

    getQueueStats() {
        const active = queueInstance.active ? 1 : 0;
        const waiting = queueInstance.queue.length;
        const completed = queueInstance.jobResults.size;
        
        return {
            active,
            waiting,
            completed,
            total: active + waiting
        };
    }
};

module.exports = {
    queueTracker
}; 