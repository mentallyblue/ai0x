const Queue = require('better-queue');
const Repository = require('../models/Repository');

class QueueTracker {
    constructor() {
        this.queue = new Queue(async (job, cb) => {
            try {
                await this.processJob(job);
                cb(null, job);
            } catch (error) {
                cb(error);
            }
        }, {
            maxTimeout: 1000 * 60 * 10, // 10 minutes max per job
            concurrent: 1,
            maxRetries: 2,
            retryDelay: 1000 * 30 // 30 seconds between retries
        });

        // Queue settings
        this.MAX_QUEUE_SIZE = 10;
        this.SPAM_THRESHOLD = 3; // Number of attempts before ban
        this.BAN_DURATION = 1000 * 60 * 60 * 24; // 24 hour ban
        this.ATTEMPT_RESET_TIME = 1000 * 60 * 15; // Reset attempts after 15 minutes

        // Track IPs and bans
        this.ipAttempts = new Map(); // IP -> {count, timestamp}
        this.bannedIPs = new Map(); // IP -> unban time
    }

    isBanned(ip) {
        const banExpiry = this.bannedIPs.get(ip);
        if (banExpiry && Date.now() < banExpiry) {
            return true;
        }
        // Clean up expired ban
        if (banExpiry) {
            this.bannedIPs.delete(ip);
        }
        return false;
    }

    banIP(ip) {
        const banUntil = Date.now() + this.BAN_DURATION;
        this.bannedIPs.set(ip, banUntil);
        console.log(`Banned IP ${ip} until ${new Date(banUntil)}`);
    }

    recordAttempt(ip) {
        const now = Date.now();
        let attempts = this.ipAttempts.get(ip);

        // Initialize or reset if too old
        if (!attempts || (now - attempts.timestamp > this.ATTEMPT_RESET_TIME)) {
            attempts = { count: 1, timestamp: now };
        } else {
            attempts.count++;
        }

        this.ipAttempts.set(ip, attempts);

        // Check if should be banned
        if (attempts.count >= this.SPAM_THRESHOLD) {
            this.banIP(ip);
            throw new Error(`Too many attempts. You have been banned for 24 hours.`);
        }

        return attempts.count;
    }

    async addToQueue(repoFullName, ip) {
        // Check if IP is banned
        if (this.isBanned(ip)) {
            const banExpiry = this.bannedIPs.get(ip);
            const minutesLeft = Math.ceil((banExpiry - Date.now()) / (1000 * 60));
            throw new Error(`You are banned. Try again in ${minutesLeft} minutes.`);
        }

        // Check queue size
        const currentSize = await this.getQueueSize();
        if (currentSize >= this.MAX_QUEUE_SIZE) {
            const attemptCount = this.recordAttempt(ip);
            const attemptsLeft = this.SPAM_THRESHOLD - attemptCount;
            
            if (attemptsLeft > 0) {
                throw new Error(`Queue is full. ${attemptsLeft} attempts remaining before ban.`);
            } else {
                throw new Error('Queue is full. You have been banned for spamming.');
            }
        }

        // Add to queue
        const jobId = Date.now();
        this.queue.push({
            id: jobId,
            repoFullName,
            ip,
            addedAt: Date.now()
        });

        return jobId;
    }

    async getQueueSize() {
        return new Promise((resolve) => {
            this.queue.getStats((err, stats) => {
                resolve(stats?.total || 0);
            });
        });
    }

    async getQueuePosition(jobId) {
        return new Promise((resolve) => {
            this.queue.getStats((err, stats) => {
                if (err || !stats) {
                    resolve({ position: -1, total: 0 });
                    return;
                }
                
                let position = -1;
                this.queue.getJobs((err, jobs) => {
                    if (jobs) {
                        position = jobs.findIndex(job => job.id === jobId) + 1;
                    }
                    resolve({
                        position: position,
                        total: stats.total,
                        maxSize: this.MAX_QUEUE_SIZE
                    });
                });
            });
        });
    }

    // ... rest of existing methods ...
}

const queueTracker = new QueueTracker();
module.exports = { queueTracker }; 