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
    let match;
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

    // Calculate LARP score as average
    const larpScore = count > 0 ? Math.round(totalScore / count) : 0;

    return {
        detailedScores: {
            codeQuality: scores.codequality || 0,
            projectStructure: scores.projectstructure || 0,
            implementation: scores.implementation || 0,
            documentation: scores.documentation || 0
        },
        larpScore
    };
}

function extractCodeReview(analysis) {
    try {
        const codeReview = {
            logicFlow: [],
            processArchitecture: [],
            codeOrganization: [],
            criticalPath: []
        };

        const sections = {
            logicFlow: /## Logic Flow\n([\s\S]*?)(?=\n##|$)/,
            processArchitecture: /## Process Architecture\n([\s\S]*?)(?=\n##|$)/,
            codeOrganization: /## Code Organization Review\n([\s\S]*?)(?=\n##|$)/,
            criticalPath: /## Critical Path Analysis\n([\s\S]*?)(?=\n##|$)/
        };

        for (const [key, pattern] of Object.entries(sections)) {
            const section = analysis.match(pattern);
            if (section) {
                codeReview[key] = section[1]
                    .split('\n')
                    .filter(line => line.trim().startsWith('-'))
                    .map(line => line.trim().replace(/^- /, ''));
            }
        }

        return codeReview;
    } catch (error) {
        console.error('Error extracting code review:', error);
        return null;
    }
}

module.exports = {
    sanitizeCodeContent,
    getFileExtension,
    extractScores,
    extractCodeReview
}; 