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

module.exports = mongoose.model('Repository', repositorySchema); 