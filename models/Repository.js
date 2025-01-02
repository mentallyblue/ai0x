const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema({
    fullName: { type: String, required: true, unique: true },
    owner: String,
    repoName: String,
    description: String,
    language: String,
    stars: Number,
    forks: Number,
    lastAnalyzed: { type: Date, default: Date.now },
    analysis: {
        larpScore: { type: Number, default: null },
        detailedScores: {
            codeQuality: Number,
            projectStructure: Number,
            implementation: Number,
            documentation: Number
        },
        codeQuality: String,
        technicalAnalysis: String,
        redFlags: [String],
        techStack: [String],
        fullAnalysis: String
    },
    scanHistory: [{
        date: { type: Date, default: Date.now },
        larpScore: Number,
        apiKey: String
    }],
    summary: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Repository', repositorySchema); 