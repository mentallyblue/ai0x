module.exports = {
    tweetConfig: {
        maxLength: 180,
        linkLength: 23,
        spacing: 5,
        maxToolAttempts: 3,
        historySize: 50,
        compressConfig: {
            maxFeatures: 3,
            maxTechStack: 5,
            maxSummaryLength: 150
        }
    },
    
    analysisFields: {
        // Configure which fields get passed to Claude
        required: ['fullName', 'analysis.finalLegitimacyScore'],
        technical: [
            'analysis.codeReview.techStack',
            'analysis.codeReview.logicFlow',
            'analysis.codeReview.aiAnalysis.score',
            'analysis.detailedScores'
        ],
        context: [
            'analysis.summary',
            'analysis.codeReview.investmentRanking',
            'stars',
            'forks'
        ]
    }
}; 