const Repository = require('../models/Repository');
const { analyzeRepo } = require('./analyzer');

class InMemoryQueue {
    constructor() {
        this.queue = new Map();
        this.active = null;
        this.jobCounter = 0;
        this.jobResults = new Map();
        this.completedJobs = new Map();
        this.processingTimeout = 30 * 60 * 1000;
        this.maxConcurrent = 5; // Allow multiple concurrent processing
        this.activeJobs = new Set();
        this.mutex = new Map(); // For job-level locking
        
        // Start multiple queue processors
        for (let i = 0; i < this.maxConcurrent; i++) {
            this.processQueue();
        }
        
        // Rate limiting
        this.rateLimits = new Map(); // IP-based rate limiting
        this.rateWindow = 60 * 1000; // 1 minute window
        this.maxRequestsPerWindow = 10; // Max requests per IP per window
        
        // Cleanup intervals
        setInterval(() => this.cleanup(), 15 * 60 * 1000);
        setInterval(() => this.cleanupRateLimits(), 60 * 1000);
    }

    async acquireLock(key) {
        while (this.mutex.get(key)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.mutex.set(key, true);
    }

    releaseLock(key) {
        this.mutex.delete(key);
    }

    checkRateLimit(ip) {
        const now = Date.now();
        const userRequests = this.rateLimits.get(ip) || [];
        
        // Clean old requests
        const validRequests = userRequests.filter(time => now - time < this.rateWindow);
        
        if (validRequests.length >= this.maxRequestsPerWindow) {
            return false;
        }
        
        validRequests.push(now);
        this.rateLimits.set(ip, validRequests);
        return true;
    }

    async add(data, ip) {
        try {
            // Check rate limit
            if (!this.checkRateLimit(ip)) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }

            await this.acquireLock('queue');
            try {
                // Validate input
                if (!data || !data.repoFullName) {
                    throw new Error('Invalid repository data');
                }

                // Check if repository is already in queue or being processed
                const existingJob = Array.from(this.queue.values()).find(
                    job => job.data.repoFullName === data.repoFullName
                );
                
                if (existingJob) {
                    return existingJob.id;
                }

                // Check if repository was recently analyzed
                const [owner, repo] = data.repoFullName.split('/');
                const recentAnalysis = await Repository.findOne({
                    fullName: data.repoFullName,
                    lastAnalyzed: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                });

                if (recentAnalysis) {
                    return { error: 'Repository was analyzed recently. Please wait 24 hours between analyses.' };
                }

                const jobId = `job_${++this.jobCounter}_${Date.now()}`;
                const job = {
                    id: jobId,
                    data,
                    status: 'waiting',
                    addedAt: Date.now(),
                    attempts: 0,
                    maxAttempts: 3,
                    ip: ip
                };

                this.queue.set(jobId, job);
                console.log(`Added job ${jobId} to queue. Queue size: ${this.queue.size}`);
                this.broadcastQueueUpdate();
                return jobId;
            } finally {
                this.releaseLock('queue');
            }
        } catch (error) {
            console.error('Queue add error:', error);
            throw error;
        }
    }

    async getPosition(jobId) {
        if (!jobId || typeof jobId !== 'string' || !jobId.startsWith('job_')) {
            console.error('Invalid jobId format:', jobId);
            return {
                status: 'error',
                error: 'Invalid job ID format'
            };
        }

        console.log(`Checking position for job ${jobId}`);
        
        // Check completed jobs first
        if (this.completedJobs && this.completedJobs.has(jobId)) {
            const result = this.completedJobs.get(jobId);
            console.log(`Job ${jobId} found in completed jobs:`, result);
            return {
                status: 'completed',
                result: result
            };
        }

        // Check active job
        if (this.active && this.active.id === jobId) {
            console.log(`Job ${jobId} is currently processing`);
            return {
                position: 0,
                total: this.queue.size + 1,
                status: 'processing',
                startedAt: this.active.startedAt
            };
        }

        // Check queue
        if (this.queue.has(jobId)) {
            let position = 1;
            for (const [queuedJobId] of this.queue) {
                if (queuedJobId === jobId) break;
                position++;
            }

            console.log(`Job ${jobId} is at position ${position} in queue of size ${this.queue.size}`);
            return {
                position,
                total: this.queue.size + (this.active ? 1 : 0),
                status: 'waiting',
                addedAt: this.queue.get(jobId).addedAt
            };
        }

        // Job not found in any list
        console.log(`Job ${jobId} not found in any job lists. Queue size: ${this.queue.size}, Active job: ${this.active?.id}, Completed jobs: ${[...this.completedJobs.keys()]}`);
        return {
            status: 'not_found',
            error: 'Job not found'
        };
    }

    async processQueue() {
        while (true) {
            try {
                if (this.activeJobs.size >= this.maxConcurrent) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                const job = await this.getNextJob();
                if (!job) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                this.activeJobs.add(job.id);
                this.processJob(job).finally(() => {
                    this.activeJobs.delete(job.id);
                });
            } catch (error) {
                console.error('Queue processing error:', error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    async getNextJob() {
        await this.acquireLock('queue');
        try {
            for (const [jobId, job] of this.queue) {
                if (!this.activeJobs.has(jobId)) {
                    this.queue.delete(jobId);
                    return job;
                }
            }
            return null;
        } finally {
            this.releaseLock('queue');
        }
    }

    async processJob(job) {
        try {
            const result = await analyzeRepo({
                owner: job.data.repoFullName.split('/')[0],
                repo: job.data.repoFullName.split('/')[1]
            });

            // Store in completedJobs instead of jobResults
            this.completedJobs.set(job.id, {
                ...result,
                timestamp: Date.now(),
                status: 'completed'
            });
            console.log(`Job ${job.id} completed successfully`);
        } catch (error) {
            console.error(`Job ${job.id} failed:`, error);
            await this.handleFailedJob(job, error);
        }
    }

    async handleFailedJob(job, error) {
        job.attempts++;
        job.lastError = error.message;

        if (job.attempts < job.maxAttempts) {
            const backoff = Math.pow(2, job.attempts) * 1000;
            console.log(`Retrying job ${job.id} after ${backoff}ms (attempt ${job.attempts})`);
            setTimeout(() => {
                this.queue.set(job.id, job);
                this.broadcastQueueUpdate();
            }, backoff);
        } else {
            console.log(`Job ${job.id} failed permanently after ${job.attempts} attempts`);
            this.jobResults.set(job.id, {
                error: `Failed after ${job.attempts} attempts: ${job.lastError}`,
                timestamp: Date.now(),
                status: 'failed'
            });
        }
    }

    cleanup() {
        const now = Date.now();

        // Clean up old completed jobs after 1 hour
        for (const [jobId, result] of this.completedJobs) {
            if (now - result.timestamp > 60 * 60 * 1000) {
                this.completedJobs.delete(jobId);
            }
        }

        // Clean up old results
        for (const [jobId, result] of this.jobResults) {
            if (now - result.timestamp > 6 * 60 * 60 * 1000) {
                this.jobResults.delete(jobId);
            }
        }

        // Clean up stalled jobs
        if (this.active && now - this.active.startedAt > this.processingTimeout) {
            console.warn(`Job ${this.active.id} timed out after ${this.processingTimeout}ms`);
            this.handleFailedJob(this.active, new Error('Processing timeout'));
            this.active = null;
        }

        // Clean up old queued jobs
        for (const [jobId, job] of this.queue) {
            if (now - job.addedAt > 24 * 60 * 60 * 1000) {
                this.queue.delete(jobId);
            }
        }

        this.broadcastQueueUpdate();
    }

    cleanupRateLimits() {
        const now = Date.now();
        for (const [ip, times] of this.rateLimits) {
            const validTimes = times.filter(time => now - time < this.rateWindow);
            if (validTimes.length === 0) {
                this.rateLimits.delete(ip);
            } else {
                this.rateLimits.set(ip, validTimes);
            }
        }
    }

    broadcastQueueUpdate() {
        if (global.io) {
            global.io.emit('queueUpdate', {
                size: this.queue.size + (this.active ? 1 : 0),
                active: this.active ? {
                    id: this.active.id,
                    repo: this.active.data.repoFullName,
                    startedAt: this.active.startedAt
                } : null
            });
        }
    }
}

// Create singleton instance
const queueInstance = new InMemoryQueue();

// Export queue interface
const queueTracker = {
    async addToQueue(repoFullName) {
        console.log('Adding to queue:', repoFullName);
        return queueInstance.add({ repoFullName });
    },

    async getQueuePosition(jobId) {
        return queueInstance.getPosition(jobId);
    }
};

module.exports = {
    queueTracker
}; 