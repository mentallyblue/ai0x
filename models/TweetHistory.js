const mongoose = require('mongoose');

const tweetHistorySchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    repoName: {
        type: String,
        required: true,
        index: true
    },
    analysisIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository'
    }],
    analysisUrl: String,
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    metrics: {
        impressions: { type: Number, default: 0 },
        engagements: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 }
    }
}, {
    collection: 'tweet_history'
});

// Index for querying recent tweets
tweetHistorySchema.index({ timestamp: -1 });

// TTL index to automatically delete old tweets after 30 days
tweetHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

let TweetHistory;

module.exports = {
    schema: tweetHistorySchema,
    init: (connection) => {
        if (!TweetHistory) {
            TweetHistory = connection.model('TweetHistory', tweetHistorySchema);
        }
        return TweetHistory;
    }
}; 