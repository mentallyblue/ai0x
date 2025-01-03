const mongoose = require('mongoose');

const RepositorySchema = new mongoose.Schema({
    fullName: { type: String, required: true, unique: true },
    owner: String,
    repoName: String,
    description: String,
    language: String,
    stars: Number,
    forks: Number,
    lastAnalyzed: { type: Date, default: Date.now },
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
        codeReview: Object,
        fullAnalysis: String,
        summary: String
    }
});

module.exports = mongoose.model('Repository', RepositorySchema); 