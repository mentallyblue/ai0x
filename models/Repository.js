const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema({
    fullName: String,
    owner: String,
    repoName: String,
    description: String,
    language: String,
    stars: Number,
    forks: Number,
    lastAnalyzed: Date,
    analysis: {
        detailedScores: {
            codeQuality: Number,
            projectStructure: Number,
            implementation: Number,
            documentation: Number
        },
        legitimacyScore: Number,
        trustScore: Number,
        finalLegitimacyScore: Number,
        codeReview: {
            // ... other code review fields
        },
        fullAnalysis: String,
        summary: String
    },
    summary: String
});

// Add index for faster cache lookups
repositorySchema.index({ owner: 1, repoName: 1, lastAnalyzed: -1 });

// Add compound index for common queries
repositorySchema.index({ fullName: 1, lastAnalyzed: -1 });

module.exports = mongoose.model('Repository', repositorySchema); 