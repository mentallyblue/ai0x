const config = require('../config/config');
const EventEmitter = require('events');
const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    throttle: {
        onRateLimit: (retryAfter, options, octokit) => {
            console.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
            if (options.request.retryCount < 2) {
                console.log(`Retrying after ${retryAfter} seconds!`);
                return true;
            }
        },
        onSecondaryRateLimit: (retryAfter, options, octokit) => {
            console.warn(`Secondary rate limit hit for ${options.method} ${options.url}`);
            if (options.request.retryCount < 2) {
                return true;
            }
        }
    }
});

class InMemoryQueue extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.active = null;
        this.jobCounter = 0;
        this.jobResults = new Map();
        this.jobRetries = new Map();
        this.isProcessing = false;
        this.processingJobs = new Set(); // Track concurrent jobs
        this.rateLimitResetTime = null;
        
        // Start queue processing and cleanup
        this.startProcessing();
        this.startCleanup();
        
        // Add queue reset timer - every 1 minute
        setInterval(() => {
            this.resetQueue();
        }, 60 * 1000); // 60 seconds * 1000ms

        // Check GitHub rate limits every minute
        this.checkRateLimits();
        setInterval(() => this.checkRateLimits(), 60 * 1000);
    }

    async checkRateLimits() {
        try {
            const { data } = await octokit.rateLimit.get();
            const { remaining, reset } = data.rate;
            
            if (remaining < 100) { // Buffer of 100 requests
                const waitTime = (reset * 1000) - Date.now();
                console.log(`Rate limit low (${remaining}), pausing queue for ${Math.ceil(waitTime/1000)}s`);
                this.rateLimitResetTime = reset * 1000;
                this.pauseProcessing();
                
                // Resume after rate limit resets
                setTimeout(() => {
                    console.log('Resuming queue processing after rate limit reset');
                    this.rateLimitResetTime = null;
                    this.startProcessing();
                }, waitTime);
            }
        } catch (error) {
            console.error('Error checking rate limits:', error);
        }
    }

    pauseProcessing() {
        this.isProcessing = false;
        // Notify clients about pause
        if (global.io) {
            global.io.emit('queueStatus', {
                status: 'paused',
                resumeTime: this.rateLimitResetTime
            });
        }
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
            priority: data.priority || 0,
            timeout: setTimeout(() => this.handleJobTimeout(jobId), 
                              config.QUEUE_CONFIG.jobTimeout)
        };

        // Insert job in priority order
        const insertIndex = this.queue.findIndex(j => j.priority <= job.priority);
        if (insertIndex === -1) {
            this.queue.push(job);
        } else {
            this.queue.splice(insertIndex, 0, job);
        }

        this.broadcastQueueSize();

        // Broadcast new job added
        global.io?.emit('globalQueueUpdate', {
            event: 'new_analysis',
            repo: data.repoFullName
        });

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
            // Retry the job with exponential backoff
            this.jobRetries.set(job.id, retries + 1);
            const backoffDelay = config.QUEUE_CONFIG.retryDelay * Math.pow(2, retries);
            
            setTimeout(() => {
                this.queue.push({
                    ...job,
                    status: 'waiting',
                    addedAt: Date.now(),
                    priority: job.priority - 1 // Slightly decrease priority on retry
                });
                this.broadcastQueueSize();
            }, backoffDelay);
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
            // Check if we can process more jobs
            if (this.processingJobs.size >= config.QUEUE_CONFIG.maxConcurrent || 
                this.queue.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            const job = this.queue.shift();
            this.processingJobs.add(job.id);
            this.broadcastQueueSize();

            // Process job asynchronously
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
            // Check rate limits before processing
            if (this.rateLimitResetTime && Date.now() < this.rateLimitResetTime) {
                throw new Error('Rate limit exceeded, job will be retried later');
            }

            // Broadcast when job starts processing
            global.io?.emit('globalQueueUpdate', {
                event: 'processing_started',
                repo: job.data.repoFullName
            });

            clearTimeout(job.timeout);
            const { analyzeRepo } = require('./analyzer');
            const [owner, repo] = job.data.repoFullName.split('/');
            
            const result = await analyzeRepo({ owner, repo });
            
            this.jobResults.set(job.id, {
                ...result,
                timestamp: Date.now(),
                status: 'completed'
            });

            // Broadcast when job completes
            global.io?.emit('globalQueueUpdate', {
                event: 'analysis_complete',
                repo: job.data.repoFullName
            });

            // Broadcast completion
            global.io?.emit('analysisComplete', {
                jobId: job.id,
                result: result
            });

            return result;
        } catch (error) {
            await this.handleJobFailure(job, error);
        }
    }

    async getPosition(jobId) {
        // Check if job is completed
        if (this.jobResults.has(jobId)) {
            return {
                position: 0,
                total: this.getTotalJobs(),
                status: 'completed',
                result: this.jobResults.get(jobId)
            };
        }

        // Check if job is processing
        if (this.processingJobs.has(jobId)) {
            return {
                position: 0,
                total: this.getTotalJobs(),
                status: 'processing'
            };
        }

        // Find position in queue
        const position = this.queue.findIndex(job => job.id === jobId);
        if (position === -1) {
            return {
                position: -1,
                total: this.getTotalJobs(),
                status: 'not_found'
            };
        }

        return {
            position: position + 1,
            total: this.getTotalJobs(),
            status: 'waiting'
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
                waiting: this.queue.length,
                positions: {}
            };

            // Get positions for all jobs in queue
            this.queue.forEach((job, index) => {
                queueStats.positions[job.id] = index + 1;
            });

            // Add processing jobs as position 0
            this.processingJobs.forEach(job => {
                queueStats.positions[job.id] = 0;
            });

            global.io.emit('queueUpdate', queueStats);
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

    resetQueue() {
        console.log('🔄 Resetting queue...');
        
        // Store currently processing jobs
        const processing = new Set(this.processingJobs);
        
        // Clear queue
        this.queue = [];
        
        // Reset job tracking but keep processing jobs
        this.processingJobs = processing;
        
        // Broadcast queue reset
        if (global.io) {
            global.io.emit('queueReset', {
                message: 'Queue has been reset',
                processing: this.processingJobs.size
            });
        }

        this.broadcastQueueSize();
        console.log('✅ Queue reset complete');
    }
}

// Create singleton instance
const queueInstance = new InMemoryQueue();

// Export queue interface
const queueTracker = {
    async addToQueue(repoFullName, priority = 0) {
        return queueInstance.add({ repoFullName, priority });
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
        // Store the IP for the job
        queueInstance.jobIPs = queueInstance.jobIPs || new Map();
        queueInstance.jobIPs.set(jobId, clientIP);
        
        // Clean up old entries after job completes
        setTimeout(() => {
            queueInstance.jobIPs.delete(jobId);
        }, 1000 * 60 * 60); // Clean up after 1 hour
    }
};

module.exports = { queueTracker }; 