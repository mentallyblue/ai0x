const Repository = require('../models/Repository');

async function saveAnalysis(repoDetails, analysisData, scores, summary) {
    try {
        const analysis = {
            detailedScores: scores.detailedScores,
            legitimacyScore: scores.legitimacyScore,
            trustScore: analysisData.trustScore,
            finalLegitimacyScore: analysisData.finalLegitimacyScore,
            codeReview: analysisData.codeReview,
            fullAnalysis: analysisData.fullAnalysis,
            summary
        };

        const repositoryData = {
            fullName: repoDetails.full_name,
            owner: repoDetails.owner.login,
            repoName: repoDetails.name,
            description: summary,
            language: repoDetails.language,
            stars: repoDetails.stargazers_count,
            forks: repoDetails.forks_count,
            lastAnalyzed: new Date(),
            analysis,
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
        throw error;
    }
}

async function getAnalysisHistory() {
    try {
        return await Repository.find()
            .select({
                fullName: 1,
                description: 1,
                language: 1,
                stars: 1,
                forks: 1,
                lastAnalyzed: 1,
                'analysis.detailedScores': 1,
                'analysis.legitimacyScore': 1,
                'analysis.trustScore': 1,
                'analysis.finalLegitimacyScore': 1,
                summary: 1
            })
            .sort({ lastAnalyzed: -1 })
            .limit(50);
    } catch (error) {
        console.error('Error fetching analysis history:', error);
        throw new Error('Failed to fetch analysis history');
    }
}

async function getRecentAnalyses() {
    try {
        // Log the raw query for debugging
        console.log('Executing recent analyses query...');
        
        const analyses = await Repository.find()
            .select({
                fullName: 1,
                description: 1,
                language: 1,
                stars: 1,
                forks: 1,
                lastAnalyzed: 1,
                analysis: 1  // Select the entire analysis object
            })
            .sort({ lastAnalyzed: -1 })
            .limit(10)
            .lean();  // Convert to plain JavaScript objects

        // Log the raw response
        console.log('Raw DB response:', JSON.stringify(analyses, null, 2));

        // Return the unmodified analyses
        return analyses;
    } catch (error) {
        console.error('Error fetching recent analyses:', error);
        throw new Error('Failed to fetch recent analyses');
    }
}

module.exports = { saveAnalysis, getAnalysisHistory, getRecentAnalyses }; 