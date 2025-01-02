const Anthropic = require('@anthropic-ai/sdk');
const { getRepoDetails, getRepoContents } = require('../utils/githubUtils');
const Repository = require('../models/Repository');
const ApiKey = require('../models/ApiKey');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

async function analyzeRepo(repoInfo, userApiKey = null) {
    // Check if recent analysis exists (less than 24 hours old)
    const existingRepo = await Repository.findOne({
        fullName: `${repoInfo.owner}/${repoInfo.repo}`
    });

    if (existingRepo && 
        existingRepo.lastAnalyzed > Date.now() - 24 * 60 * 60 * 1000) {
        return {
            repoDetails: existingRepo,
            analysis: existingRepo.analysis.fullAnalysis,
            cached: true
        };
    }

    const repoDetails = await getRepoDetails(repoInfo);
    const codeContents = await getRepoContents(repoInfo);
    
    // Perform AI integration analysis
    const aiIntegrations = detectAIIntegrations(codeContents);
    const logicFlow = mapAILogicFlow(codeContents, aiIntegrations);

    // Add AI findings to the prompt
    const aiAnalysis = `
    AI Integration Analysis:
    ${JSON.stringify(aiIntegrations, null, 2)}

    Logic Flow Analysis:
    ${JSON.stringify(logicFlow, null, 2)}
    `;

    const prompt = `You are analyzing a GitHub repository. Provide a detailed technical assessment.
    
    Repository Details:
    - Name: ${repoDetails.full_name}
    - Description: ${repoDetails.description || 'No description provided'}
    - Stars: ${repoDetails.stargazers_count}
    - Forks: ${repoDetails.forks_count}
    - Issues: ${repoDetails.open_issues_count}
    - Last Updated: ${repoDetails.updated_at}
    - Language: ${repoDetails.language}
    - Topics: ${repoDetails.topics?.join(', ') || 'None'}
    - Watchers: ${repoDetails.watchers_count}

    Code Analysis:
    ${codeContents.map(file => `
    File: ${file.path}
    \`\`\`${file.path.split('.').pop()}
    ${file.content}
    \`\`\`
    `).join('\n')}
    
    Please start your analysis with:

    LARP Score (0-100): [single number between 0-100]

    Then continue with the rest of your analysis...

    1. Detailed LARP Score Breakdown:
    - Code quality and organization (25 points): [score]
    - Project structure and architecture (25 points): [score]
    - Implementation completeness (25 points): [score]
    - Documentation and comments (25 points): [score]
    Total LARP Score: [sum of above]

    2. Code Quality Assessment:
    - Analyze code structure and patterns
    - Identify any anti-patterns or code smells
    - Check for proper error handling
    - Assess code organization and modularity
    
    3. Technical Implementation Analysis:
    - Evaluate the technical approach
    - Identify any logical flaws
    - Assess scalability and maintainability
    - Look for security vulnerabilities
    
    4. Beginner Mistakes & Red Flags:
    - List any novice-level coding mistakes
    - Identify copy-pasted code segments
    - Point out security oversights
    - Note any suspicious patterns
    
    5. Technology Stack Details:
    - List all identified technologies
    - Analyze how technologies are integrated
    - Assess if technologies are used appropriately
    
    6. Overall Technical Assessment:
    - Summarize the technical legitimacy
    - Rate the project's technical maturity
    - Provide specific improvement recommendations
    
    Additional Technical Analysis:
    ${aiAnalysis}
    
    Format the response in clear markdown with appropriate sections and code examples where relevant.`;

    const completion = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 4000,
        temperature: 0.7,
        messages: [
            { role: "user", content: prompt }
        ],
        system: "You are an expert software engineer specializing in code analysis and security auditing. You excel at detecting quality issues, security vulnerabilities, and assessing technical legitimacy of projects."
    });

    // Parse the analysis to extract structured data
    const analysis = completion.content[0].text;
    const larpScore = extractLarpScore(analysis);
    const detailedScores = extractDetailedScores(analysis);
    console.log('Extracted LARP score before saving:', larpScore); // Debug log
    
    // Update or create repository record
    const repoData = {
        fullName: repoDetails.full_name,
        owner: repoInfo.owner,
        repoName: repoInfo.repo,
        description: repoDetails.description,
        language: repoDetails.language,
        stars: repoDetails.stargazers_count,
        forks: repoDetails.forks_count,
        lastAnalyzed: new Date(),
        analysis: {
            fullAnalysis: analysis,
            larpScore: larpScore,
            detailedScores: detailedScores,
            techStack: extractTechStack(analysis),
            redFlags: extractRedFlags(analysis)
        }
    };

    let savedRepo;
    if (existingRepo) {
        savedRepo = await Repository.findByIdAndUpdate(
            existingRepo._id, 
            repoData,
            { new: true } // Return the updated document
        );
    } else {
        savedRepo = await Repository.create(repoData);
    }
    
    console.log('Saved LARP score:', savedRepo.analysis.larpScore); // Debug log

    // Record scan in history
    if (userApiKey) {
        await ApiKey.findOneAndUpdate(
            { key: userApiKey },
            { 
                $inc: { requestsToday: 1 },
                lastRequest: new Date()
            }
        );
    }

    return {
        repoDetails: savedRepo,
        analysis: analysis,
        cached: false
    };
}

// Helper functions to extract structured data from analysis text
function extractLarpScore(analysis) {
    try {
        // First try to find the total LARP score
        const totalPattern = /LARP Score \(0-100\):\s*(\d+)/i;
        const totalMatch = analysis.match(totalPattern);
        
        if (totalMatch && totalMatch[1]) {
            const score = parseInt(totalMatch[1], 10);
            if (score >= 0 && score <= 100) {
                return score;
            }
        }

        // If not found, try to find it in the breakdown
        const breakdownPattern = /Total LARP Score:\s*(\d+)/i;
        const breakdownMatch = analysis.match(breakdownPattern);
        
        if (breakdownMatch && breakdownMatch[1]) {
            const score = parseInt(breakdownMatch[1], 10);
            if (score >= 0 && score <= 100) {
                return score;
            }
        }

        console.log('No valid LARP score found in analysis');
        return null;
    } catch (error) {
        console.error('Error extracting LARP score:', error);
        return null;
    }
}

function extractDetailedScores(analysis) {
    try {
        const pattern = /Code quality.*?\(25 points\):\s*(\d+).*?Project structure.*?\(25 points\):\s*(\d+).*?Implementation.*?\(25 points\):\s*(\d+).*?Documentation.*?\(25 points\):\s*(\d+)/s;
        const matches = analysis.match(pattern);

        if (matches) {
            return {
                codeQuality: parseInt(matches[1], 10),
                projectStructure: parseInt(matches[2], 10),
                implementation: parseInt(matches[3], 10),
                documentation: parseInt(matches[4], 10)
            };
        }
        return null;
    } catch (error) {
        console.error('Error extracting detailed scores:', error);
        return null;
    }
}

function extractTechStack(analysis) {
    // Implement based on your analysis format
    return [];
}

function extractRedFlags(analysis) {
    // Implement based on your analysis format
    return [];
}

function detectAIIntegrations(codeContents) {
    const aiPatterns = {
        openai: {
            patterns: [/openai/i, /gpt/i, /completion/i, /davinci/i],
            apiKeys: [/sk-[a-zA-Z0-9]{32,}/],
            imports: [/(?:import|require).*?openai/],
            endpoints: [/api\.openai\.com/]
        },
        anthropic: {
            patterns: [/anthropic/i, /claude/i],
            apiKeys: [/sk-ant-api[a-zA-Z0-9-]*/],
            imports: [/(?:import|require).*?anthropic/],
            endpoints: [/api\.anthropic\.com/]
        },
        huggingface: {
            patterns: [/huggingface/i, /transformers/i],
            apiKeys: [/hf_[a-zA-Z0-9]{32,}/],
            imports: [/(?:import|require).*?transformers/]
        },
        cohere: {
            patterns: [/cohere/i],
            apiKeys: [/[a-zA-Z0-9]{32,}/],
            imports: [/(?:import|require).*?cohere/]
        },
        replicate: {
            patterns: [/replicate/i],
            apiKeys: [/r8_[a-zA-Z0-9]{32,}/],
            imports: [/(?:import|require).*?replicate/]
        }
    };

    const findings = {};
    
    for (const [provider, patterns] of Object.entries(aiPatterns)) {
        findings[provider] = {
            found: false,
            locations: [],
            imports: [],
            possibleEndpoints: [],
            apiKeyPresent: false
        };

        for (const file of codeContents) {
            // Check for patterns
            patterns.patterns.forEach(pattern => {
                if (pattern.test(file.content)) {
                    findings[provider].found = true;
                    findings[provider].locations.push(file.path);
                }
            });

            // Check for imports
            patterns.imports?.forEach(importPattern => {
                const matches = file.content.match(importPattern);
                if (matches) {
                    findings[provider].imports.push({
                        file: file.path,
                        import: matches[0]
                    });
                }
            });

            // Check for API keys (safely)
            patterns.apiKeys?.forEach(keyPattern => {
                if (keyPattern.test(file.content)) {
                    findings[provider].apiKeyPresent = true;
                }
            });

            // Check for endpoints
            patterns.endpoints?.forEach(endpointPattern => {
                if (endpointPattern.test(file.content)) {
                    findings[provider].possibleEndpoints.push(file.path);
                }
            });
        }
    }

    return findings;
}

function mapAILogicFlow(codeContents, aiFindings) {
    const logicFlow = {
        entryPoints: [],
        aiCalls: [],
        dataFlow: [],
        dependencies: []
    };

    for (const file of codeContents) {
        // Look for API call patterns
        const apiCallPattern = /\.(create|generate|complete|chat|predict)\(/;
        const matches = file.content.match(new RegExp(apiCallPattern, 'g'));
        
        if (matches) {
            // Extract the surrounding function/context
            const lines = file.content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (apiCallPattern.test(lines[i])) {
                    const context = extractFunctionContext(lines, i);
                    logicFlow.aiCalls.push({
                        file: file.path,
                        line: i + 1,
                        context: context,
                        type: detectCallType(lines[i])
                    });
                }
            }
        }

        // Look for data processing before/after AI calls
        const dataProcessing = detectDataProcessing(file.content);
        if (dataProcessing.length > 0) {
            logicFlow.dataFlow.push(...dataProcessing);
        }
    }

    return logicFlow;
}

function extractFunctionContext(lines, lineIndex, contextSize = 5) {
    const start = Math.max(0, lineIndex - contextSize);
    const end = Math.min(lines.length, lineIndex + contextSize + 1);
    return lines.slice(start, end).join('\n');
}

function detectCallType(line) {
    if (line.includes('chat')) return 'chat';
    if (line.includes('complete')) return 'completion';
    if (line.includes('generate')) return 'generation';
    if (line.includes('predict')) return 'prediction';
    return 'unknown';
}

function detectDataProcessing(content) {
    const patterns = [
        { type: 'preprocessing', pattern: /(clean|normalize|format|prepare|transform).*?data/i },
        { type: 'postprocessing', pattern: /(parse|process|handle|format).*?response/i },
        { type: 'error_handling', pattern: /(catch|error|exception|handle)/i }
    ];

    return patterns
        .map(p => ({
            type: p.type,
            found: p.pattern.test(content)
        }))
        .filter(result => result.found);
}

module.exports = { analyzeRepo }; 