const Repository = require('../models/Repository');

async function saveAnalysis(repoDetails, analysis, scores, summary) {
    try {
        const repositoryData = {
            fullName: repoDetails.full_name,
            owner: repoDetails.owner.login,
            repoName: repoDetails.name,
            description: summary,
            language: repoDetails.language,
            stars: repoDetails.stargazers_count,
            forks: repoDetails.forks_count,
            lastAnalyzed: new Date(),
            analysis: {
                ...scores,
                codeReview: analysis.codeReview,
                fullAnalysis: analysis.fullAnalysis
            },
            summary
        };

        // Upsert the repository data
        return await Repository.findOneAndUpdate(
            { fullName: repoDetails.full_name },
            repositoryData,
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error('Error saving analysis:', error);
        throw new Error('Failed to save analysis to history');
    }
}

async function getAnalysisHistory() {
    try {
        return await Repository.find()
            .sort({ lastAnalyzed: -1 })
            .limit(50);
    } catch (error) {
        console.error('Error fetching analysis history:', error);
        throw new Error('Failed to fetch analysis history');
    }
}

module.exports = { saveAnalysis, getAnalysisHistory }; 