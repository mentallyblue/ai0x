// Helper functions for analysis parsing and extraction
function sanitizeCodeContent(content) {
    if (typeof content !== 'string') return '';
    return content
        .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\uD800-\uDFFF]/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .slice(0, 2000);
}

function getFileExtension(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const languageMap = {
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        'java': 'java',
        'go': 'go',
        'rs': 'rust',
        'cpp': 'cpp',
        'c': 'c',
        'jsx': 'javascript',
        'tsx': 'typescript',
        'vue': 'vue',
        'php': 'php',
        'rb': 'ruby',
        'sol': 'solidity',
        'cs': 'csharp',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'md': 'markdown',
        'json': 'json',
        'yml': 'yaml',
        'yaml': 'yaml'
    };
    return languageMap[ext] || ext;
}

function extractScores(analysis) {
    // Updated regex to better match the prompt format
    const scorePattern = /(?:Code Quality|Project Structure|Implementation|Documentation)\s*\(Score:\s*(\d+)\/25\)/g;
    const scores = {};
    let totalScore = 0;
    let count = 0;
    
    // Extract category scores
    while ((match = scorePattern.exec(analysis)) !== null) {
        const score = parseInt(match[1], 10);
        if (!isNaN(score)) {
            const category = match[0].split('(')[0].trim().replace(/\s+/g, '').toLowerCase();
            scores[category] = score;
            totalScore += score;
            count++;
        }
    }

    // Calculate legitimacy score as percentage (0-100)
    const legitimacyScore = count > 0 ? Math.round((totalScore / (count * 25)) * 100) : 0;

    return {
        detailedScores: {
            codeQuality: scores.codequality || 0,
            projectStructure: scores.projectstructure || 0,
            implementation: scores.implementation || 0,
            documentation: scores.documentation || 0
        },
        legitimacyScore
    };
}

function extractCodeReview(analysis) {
    try {
        const codeReview = {
            logicFlow: [],
            processArchitecture: [],
            codeOrganization: [],
            criticalPath: [],
            misrepresentationChecks: [],
            larpIndicators: [],
            redFlags: [],
            overallAssessment: '',
            investmentRanking: {
                rating: '',
                confidence: 0,
                reasoning: []
            },
            aiAnalysis: {
                hasAI: false,
                components: [],
                score: 0,
                misleadingLevel: 'None',
                implementationQuality: 'N/A',
                concerns: [],
                details: ''
            }
        };

        const sections = {
            logicFlow: /## Logic Flow\n([\s\S]*?)(?=\n##|$)/,
            processArchitecture: /## Process Architecture\n([\s\S]*?)(?=\n##|$)/,
            codeOrganization: /## Code Organization Review\n([\s\S]*?)(?=\n##|$)/,
            criticalPath: /## Critical Path Analysis\n([\s\S]*?)(?=\n##|$)/,
            misrepresentationChecks: /## Misrepresentation Checks\n([\s\S]*?)(?=\n##|$)/,
            larpIndicators: /## LARP Indicators\n([\s\S]*?)(?=\n##|$)/,
            redFlags: /## Red Flags\n([\s\S]*?)(?=\n##|$)/,
            overallAssessment: /## Overall Assessment\n([\s\S]*?)(?=\n##|$)/,
            investmentRanking: /## Investment Ranking \(NFA\)\n([\s\S]*?)(?=\n##|$)/
        };

        for (const [key, pattern] of Object.entries(sections)) {
            const section = analysis.match(pattern);
            if (section) {
                if (key === 'overallAssessment') {
                    codeReview[key] = section[1].trim();
                } else if (key === 'investmentRanking') {
                    const investmentSection = section[1];
                    const ratingMatch = investmentSection.match(/Rating: (.*?)(?:\n|$)/);
                    const confidenceMatch = investmentSection.match(/Confidence: (\d+)%/);
                    const reasoningLines = investmentSection
                        .split('\n')
                        .filter(line => line.trim().startsWith('-'))
                        .map(line => line.trim().replace(/^- /, ''));

                    codeReview[key] = {
                        rating: ratingMatch ? ratingMatch[1].trim() : '',
                        confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 0,
                        reasoning: reasoningLines
                    };
                } else {
                    codeReview[key] = section[1]
                        .split('\n')
                        .filter(line => line.trim().startsWith('-'))
                        .map(line => line.trim().replace(/^- /, ''));
                }
            }
        }

        // Add AI section extraction
        const aiSection = analysis.match(/## AI Implementation Analysis\n([\s\S]*?)(?=\n##|$)/);
        if (aiSection) {
            const aiText = aiSection[1];
            
            // Extract AI components
            const components = aiText
                .split('\n')
                .filter(line => line.trim().startsWith('-'))
                .map(line => line.trim().replace(/^- /, ''));
            
            // Extract AI score
            const scoreMatch = aiText.match(/AI Score: (\d+)/);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
            
            // Extract misleading level
            const misleadingMatch = aiText.match(/Misleading Level: (None|Low|Medium|High)/);
            const misleadingLevel = misleadingMatch ? misleadingMatch[1] : 'None';
            
            // Extract implementation quality
            const qualityMatch = aiText.match(/Implementation Quality: (Poor|Basic|Good|Excellent)/);
            const implementationQuality = qualityMatch ? qualityMatch[1] : 'N/A';
            
            // Update AI analysis object
            codeReview.aiAnalysis = {
                hasAI: components.length > 0,
                components,
                score,
                misleadingLevel,
                implementationQuality,
                concerns: components.filter(c => 
                    c.toLowerCase().includes('concern') || 
                    c.toLowerCase().includes('issue') ||
                    c.toLowerCase().includes('misleading')
                ),
                details: aiText.trim()
            };
        }

        return codeReview;
    } catch (error) {
        console.error('Error extracting code review:', error);
        return null;
    }
}

// Update calculateTrustScore to contribute to legitimacy score
function calculateTrustScore(codeReview) {
    try {
        const redFlagsCount = codeReview.redFlags.length;
        const larpIndicatorsCount = codeReview.larpIndicators.length;
        const misrepresentationCount = codeReview.misrepresentationChecks.filter(check => 
            check.toLowerCase().includes('suspicious') || 
            check.toLowerCase().includes('concern')
        ).length;

        // Add AI-specific trust factors
        const aiMisleadingPenalty = {
            'None': 0,
            'Low': 10,
            'Medium': 20,
            'High': 30
        }[codeReview.aiAnalysis.misleadingLevel] || 0;

        const aiConcernsPenalty = codeReview.aiAnalysis.concerns.length * 5;

        // Start with 100 and deduct for issues
        let trustScore = 100;
        trustScore -= (redFlagsCount * 15);        // -15 points per red flag
        trustScore -= (larpIndicatorsCount * 10);  // -10 points per LARP indicator
        trustScore -= (misrepresentationCount * 20); // -20 points per misrepresentation
        trustScore -= aiMisleadingPenalty;         // Penalty for misleading AI claims
        trustScore -= aiConcernsPenalty;           // -5 points per AI concern

        // Ensure score stays between 0 and 100
        return Math.max(0, Math.min(100, trustScore));
    } catch (error) {
        console.error('Error calculating trust score:', error);
        return 0;
    }
}

// New function to combine scores into final legitimacy score
function calculateFinalLegitimacyScore(legitimacyScore, trustScore) {
    // Weight both scores equally
    return Math.round((legitimacyScore + trustScore) / 2);
}

module.exports = {
    sanitizeCodeContent,
    getFileExtension,
    extractScores,
    extractCodeReview,
    calculateTrustScore,
    calculateFinalLegitimacyScore
}; 