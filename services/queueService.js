const EventEmitter = require('events');

class InMemoryQueue extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.active = null;
        this.jobCounter = 0;
        this.jobResults = new Map();
        this.isProcessing = false;
        this.processingJobs = new Set();
        
        // Start queue processing
        this.startProcessing();
        
        // Reset queue every minute
        setInterval(() => {
            this.resetQueue();
        }, 60 * 1000);
    }

    startProcessing() {
        if (!this.isProcessing) {
            this.isProcessing = true;
            this.processQueue();
        }
    }

    async add(data) {
        const jobId = ++this.jobCounter;
        const job = {
            id: jobId,
            data,
            status: 'waiting',
            addedAt: Date.now()
        };

        this.queue.push(job);
        this.broadcastQueueSize();

        // Broadcast new job added
        global.io?.emit('globalQueueUpdate', {
            event: 'new_analysis',
            repo: data.repoFullName
        });

        return jobId;
    }

    async processQueue() {
        while (this.isProcessing) {
            if (this.queue.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            const job = this.queue.shift();
            this.processingJobs.add(job.id);
            this.broadcastQueueSize();

            this.processJob(job).catch(error => {
                console.error(`Error processing job ${job.id}:`, error);
            }).finally(() => {
                this.processingJobs.delete(job.id);
                this.broadcastQueueSize();
            });
        }
    }

    async processJob(job) {
        try {
            global.io?.emit('globalQueueUpdate', {
                event: 'processing_started',
                repo: job.data.repoFullName
            });

            const { analyzeRepo } = require('./analyzer');
            const [owner, repo] = job.data.repoFullName.split('/');
            
            const result = await analyzeRepo({ owner, repo });
            
            this.jobResults.set(job.id, {
                ...result,
                timestamp: Date.now(),
                status: 'completed'
            });

            global.io?.emit('globalQueueUpdate', {
                event: 'analysis_complete',
                repo: job.data.repoFullName
            });

            global.io?.emit('analysisComplete', {
                jobId: job.id,
                result: result
            });

            return result;
        } catch (error) {
            console.error('Job processing error:', error);
            throw error;
        }
    }

    async getPosition(jobId) {
        if (this.jobResults.has(jobId)) {
            return {
                position: 0,
                total: this.getTotalJobs(),
                status: 'completed',
                result: this.jobResults.get(jobId)
            };
        }

        if (this.processingJobs.has(jobId)) {
            return {
                position: 0,
                total: this.getTotalJobs(),
                status: 'processing'
            };
        }

        const position = this.queue.findIndex(job => job.id === jobId);
        return {
            position: position === -1 ? -1 : position + 1,
            total: this.getTotalJobs(),
            status: position === -1 ? 'not_found' : 'waiting'
        };
    }

    getTotalJobs() {
        return this.queue.length + this.processingJobs.size;
    }

    broadcastQueueSize() {
        if (global.io) {
            const queueStats = {
                size: this.getTotalJobs(),
                processing: this.processingJobs.size,
                waiting: this.queue.length
            };
            global.io.emit('queueUpdate', queueStats);
        }
    }

    resetQueue() {
        console.log('🔄 Resetting queue...');
        this.queue = [];
        this.broadcastQueueSize();
        console.log('✅ Queue reset complete');
    }
}

const queueInstance = new InMemoryQueue();

const queueTracker = {
    async addToQueue(repoFullName) {
        return queueInstance.add({ repoFullName });
    },

    async getQueuePosition(jobId) {
        return queueInstance.getPosition(jobId);
    },

    getQueueStats() {
        return {
            waiting: queueInstance.queue.length,
            processing: queueInstance.processingJobs.size,
            total: queueInstance.getTotalJobs()
        };
    },

    trackAnalysis(jobId, clientIP) {
        // Since we're removing rate limits, this is now just a stub
        // that allows the API to work without tracking IPs
        return true;
    }
};

module.exports = { queueTracker }; 