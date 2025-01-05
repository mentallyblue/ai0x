const Repository = require('../models/Repository');
const mongoose = require('mongoose');

// Validation helpers
const validateInput = {
    searchRepos: (input) => {
        const { minLegitimacyScore, minAiScore, techStack, limit } = input;
        
        if (minLegitimacyScore !== undefined && (
            typeof minLegitimacyScore !== 'number' || 
            minLegitimacyScore < 0 || 
            minLegitimacyScore > 100
        )) {
            throw new Error('Invalid minLegitimacyScore: must be number between 0-100');
        }

        if (minAiScore !== undefined && (
            typeof minAiScore !== 'number' || 
            minAiScore < 0 || 
            minAiScore > 100
        )) {
            throw new Error('Invalid minAiScore: must be number between 0-100');
        }

        if (techStack !== undefined && (!Array.isArray(techStack) || 
            !techStack.every(tech => typeof tech === 'string'))
        ) {
            throw new Error('Invalid techStack: must be array of strings');
        }

        if (limit !== undefined && (
            typeof limit !== 'number' || 
            limit < 1 || 
            limit > 100
        )) {
            throw new Error('Invalid limit: must be number between 1-100');
        }

        return true;
    },

    getRepoDetails: (input) => {
        const { repoName } = input;
        if (!repoName || typeof repoName !== 'string' || !repoName.includes('/')) {
            throw new Error('Invalid repoName: must be string in format owner/repo');
        }
        return true;
    },

    findSimilarRepos: (input) => {
        const { repoName, limit } = input;
        if (!repoName || typeof repoName !== 'string' || !repoName.includes('/')) {
            throw new Error('Invalid repoName: must be string in format owner/repo');
        }
        if (limit !== undefined && (
            typeof limit !== 'number' || 
            limit < 1 || 
            limit > 100
        )) {
            throw new Error('Invalid limit: must be number between 1-100');
        }
        return true;
    }
};

// Tool implementations with validation
async function searchRepos(input) {
    try {
        validateInput.searchRepos(input);
        
        const { minLegitimacyScore = 0, minAiScore = 0, techStack = [], limit = 10 } = input;
        
        const query = {
            'analysis.finalLegitimacyScore': { $gte: minLegitimacyScore }
        };
        
        if (minAiScore > 0) {
            query['analysis.codeReview.aiAnalysis.score'] = { $gte: minAiScore };
        }
        
        if (techStack.length > 0) {
            query['analysis.codeReview.techStack'] = { $in: techStack };
        }

        const results = await Repository.find(query)
            .sort({ 'analysis.finalLegitimacyScore': -1 })
            .limit(limit)
            .lean();

        return results || [];
    } catch (error) {
        console.error('Error in searchRepos:', error);
        throw error;
    }
}

async function getRepoDetails(input) {
    try {
        validateInput.getRepoDetails(input);
        
        const result = await Repository.findOne({ 
            fullName: input.repoName 
        }).lean();
        
        if (!result) {
            throw new Error(`Repository ${input.repoName} not found`);
        }
        
        return result;
    } catch (error) {
        console.error('Error in getRepoDetails:', error);
        throw error;
    }
}

async function findSimilarRepos(input) {
    try {
        validateInput.findSimilarRepos(input);
        
        const { repoName, limit = 5 } = input;
        
        const sourceRepo = await Repository.findOne({ 
            fullName: repoName 
        }).lean();
        
        if (!sourceRepo) {
            throw new Error(`Source repository ${repoName} not found`);
        }

        const similarRepos = await Repository.find({
            fullName: { $ne: repoName },
            'analysis.detailedScores.codeQuality': { 
                $gte: sourceRepo.analysis.detailedScores.codeQuality - 5,
                $lte: sourceRepo.analysis.detailedScores.codeQuality + 5
            },
            'analysis.codeReview.techStack': {
                $in: sourceRepo.analysis.codeReview.techStack || []
            }
        })
        .sort({ 'analysis.finalLegitimacyScore': -1 })
        .limit(limit)
        .lean();

        return similarRepos || [];
    } catch (error) {
        console.error('Error in findSimilarRepos:', error);
        throw error;
    }
}

// Tool definitions that we'll provide to Claude
const CLAUDE_TOOLS = [
    {
        name: "search_repos",
        description: `Search through analyzed repositories to find interesting patterns or specific technical implementations. 
        Use this when you want to:
        - Find repos with similar technical approaches
        - Compare implementations across different projects
        - Identify trending technologies or patterns
        - Discover high-scoring projects in specific areas
        
        The scores object contains:
        - codeQuality (0-25): Code architecture, patterns, and best practices
        - projectStructure (0-25): Directory organization, dependency management
        - implementation (0-25): Core functionality, integrations, efficiency
        - documentation (0-25): Code comments, API docs, setup instructions
        
        The legitimacyScore (0-100) indicates overall project validity
        The aiScore (0-100) represents AI/ML implementation quality`,
        input_schema: {
            type: "object",
            properties: {
                minLegitimacyScore: {
                    type: "number",
                    description: "Minimum legitimacy score (0-100)"
                },
                minAiScore: {
                    type: "number",
                    description: "Minimum AI implementation score (0-100)"
                },
                techStack: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of technologies to search for"
                },
                limit: {
                    type: "number",
                    description: "Maximum number of results to return"
                }
            }
        }
    },
    {
        name: "get_repo_details",
        description: `Get detailed analysis information about a specific repository.
        Use this when you want to:
        - Deep dive into a specific project's implementation
        - Verify technical claims or features
        - Get comprehensive scoring and review data
        - Access the full technical analysis
        
        Returns complete analysis including code review, scores, and technical assessment.`,
        input_schema: {
            type: "object",
            properties: {
                repoName: {
                    type: "string",
                    description: "Full repository name (owner/repo)"
                }
            },
            required: ["repoName"]
        }
    },
    {
        name: "find_similar_repos",
        description: `Find repositories with similar technical characteristics or implementations.
        Use this to:
        - Compare different approaches to similar problems
        - Identify alternative implementations
        - Find projects in the same technical domain
        
        Returns repositories that share technical similarities based on analysis.`,
        input_schema: {
            type: "object",
            properties: {
                repoName: {
                    type: "string",
                    description: "Source repository to find similar ones to"
                },
                limit: {
                    type: "number",
                    description: "Maximum number of similar repos to return"
                }
            },
            required: ["repoName"]
        }
    }
];

module.exports = {
    CLAUDE_TOOLS,
    toolFunctions: {
        search_repos: searchRepos,
        get_repo_details: getRepoDetails,
        find_similar_repos: findSimilarRepos
    }
}; 