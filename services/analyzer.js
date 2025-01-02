const Anthropic = require('@anthropic-ai/sdk');
const { getRepoDetails, getRepoContents } = require('../utils/githubUtils');
const Repository = require('../models/Repository');
const ApiKey = require('../models/ApiKey');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

async function analyzeRepo(repoInfo, userApiKey = null) {
    try {
        // Check if recent analysis exists
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
        
        // Create the analysis prompt
        const prompt = `You are analyzing a GitHub repository. Provide a detailed technical assessment in the following format:

        Repository Details:
        - Name: ${repoDetails.full_name}
        - Description: ${repoDetails.description || 'No description provided'}
        - Stars: ${repoDetails.stargazers_count}
        - Language: ${repoDetails.language}

        ${codeContents.length > 0 ? `Code Analysis:\n${codeContents.map(f => `File: ${f.path}\n${f.content}`).join('\n\n')}` : 'No code files available for analysis.'}

        Please provide your analysis in this EXACT markdown format:

        # SCORES
        LARP Score: [0-100]
        Code Quality: [0-25]
        Project Structure: [0-25]
        Implementation: [0-25]
        Documentation: [0-25]

        # Detailed Breakdown

        ## Code Quality ([score]/25)
        - [Bullet points about code quality]
        - [Discussion of naming conventions]
        - [Analysis of code organization]
        - [Comments on error handling]

        ## Project Structure ([score]/25)
        - [Analysis of directory organization]
        - [Discussion of modularity]
        - [Evaluation of file separation]
        - [Thoughts on configuration management]

        ## Implementation ([score]/25)
        - [Analysis of core functionality]
        - [Discussion of performance]
        - [Evaluation of error handling]
        - [Comments on scalability]

        ## Documentation ([score]/25)
        - [Analysis of README quality]
        - [Evaluation of code comments]
        - [Discussion of API documentation]
        - [Assessment of setup instructions]

        # Key Findings
        - [Major strength 1]
        - [Major strength 2]
        - [Key concern 1]
        - [Key concern 2]

        # Technical Deep Dive
        ## Architecture Overview
        [Detailed discussion of system architecture]

        ## Code Patterns
        [Analysis of design patterns and code organization]

        ## Performance Considerations
        [Discussion of performance implications]

        # Recommendations
        ## High Priority
        - [Critical improvement 1]
        - [Critical improvement 2]

        ## Medium Priority
        - [Important improvement 1]
        - [Important improvement 2]

        ## Low Priority
        - [Nice-to-have improvement 1]
        - [Nice-to-have improvement 2]

        # Tech Stack Analysis
        - Primary Language: [language]
        - Key Dependencies: [list major dependencies]
        - Development Tools: [list development tools]
        - Testing Framework: [testing tools used]

        # Security Considerations
        - [Security consideration 1]
        - [Security consideration 2]
        - [Potential vulnerabilities]

        # AI Integration Analysis
        [If applicable, analysis of AI-related code and patterns]

        # Red Flags
        - [Major concern 1]
        - [Major concern 2]
        - [Potential issues]`;

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            system: "You are a technical analyzer that must provide scores in this exact format: SCORES:\nLARP Score: [number]\nCode Quality: [number]\nProject Structure: [number]\nImplementation: [number]\nDocumentation: [number]",
            messages: [{ 
                role: 'user', 
                content: prompt
            }]
        });

        // Add debug logging
        console.log('Claude Response:', response.content[0].text.substring(0, 500)); // Log first 500 chars

        const analysis = response.content[0].text;
        
        // Extract structured data
        const larpScore = extractLarpScore(analysis) || 0;
        const detailedScores = extractDetailedScores(analysis) || {
            codeQuality: 0,
            projectStructure: 0,
            implementation: 0,
            documentation: 0
        };

        // Save to database
        const analysisResult = {
            fullAnalysis: analysis,
            larpScore,
            detailedScores,
            techStack: extractTechStack(analysis),
            redFlags: extractRedFlags(analysis),
            aiIntegrations: codeContents.length > 0 ? detectAIIntegrations(codeContents) : []
        };

        // Create or update repository record
        await Repository.findOneAndUpdate(
            { fullName: `${repoInfo.owner}/${repoInfo.repo}` },
            {
                owner: repoInfo.owner,
                repoName: repoInfo.repo,
                fullName: `${repoInfo.owner}/${repoInfo.repo}`,
                analysis: analysisResult,
                lastAnalyzed: Date.now(),
                language: repoDetails.language,
                stars: repoDetails.stargazers_count
            },
            { upsert: true, new: true }
        );

        return {
            repoDetails,
            analysis: analysisResult,
            cached: false
        };

    } catch (error) {
        console.error('Analysis error:', error);
        throw new Error(`Failed to analyze repository: ${error.message}`);
    }
}

// Helper functions to extract structured data from analysis text
function extractLarpScore(analysis) {
    try {
        // Debug log the input
        console.log('Analyzing text for LARP score:', analysis.substring(0, 200));

        // First try to find the scores section
        const scoresSection = analysis.match(/SCORES:[\s\S]*?(?=\n\n|$)/);
        if (scoresSection) {
            console.log('Found scores section:', scoresSection[0]);
            const larpMatch = scoresSection[0].match(/LARP Score:?\s*(\d+)/i);
            if (larpMatch && larpMatch[1]) {
                const score = parseInt(larpMatch[1], 10);
                if (score >= 0 && score <= 100) {
                    console.log('Extracted LARP score:', score);
                    return score;
                }
            }
        }

        // Fallback patterns if scores section isn't found
        const patterns = [
            /LARP Score:?\s*(\d+)/i,
            /LARP Score \(0-100\):?\s*(\d+)/i,
            /Overall LARP Score:?\s*(\d+)/i,
            /Total LARP Score:?\s*(\d+)/i,
            /LARP:?\s*(\d+)/i
        ];

        for (const pattern of patterns) {
            const match = analysis.match(pattern);
            if (match && match[1]) {
                const score = parseInt(match[1], 10);
                if (score >= 0 && score <= 100) {
                    console.log('Found LARP score using pattern:', pattern, score);
                    return score;
                }
            }
        }

        // If still no score found, try to calculate from detailed scores
        const detailedScores = extractDetailedScores(analysis);
        if (detailedScores) {
            const total = Object.values(detailedScores).reduce((sum, score) => sum + score, 0);
            const larpScore = Math.round(total * 1.0); // Scale to 100
            console.log('Calculated LARP score from detailed scores:', larpScore);
            return larpScore;
        }

        console.error('No valid LARP score found in analysis. Analysis begins with:', analysis.substring(0, 500));
        return null;
    } catch (error) {
        console.error('Error extracting LARP score:', error);
        return null;
    }
}

function extractDetailedScores(analysis) {
    try {
        const scores = {
            codeQuality: 0,
            projectStructure: 0,
            implementation: 0,
            documentation: 0
        };

        // Try to find scores section
        const scoresSection = analysis.match(/SCORES:(.*?)(?=\n\n|$)/s);
        if (scoresSection) {
            console.log('Found scores section:', scoresSection[1]); // Debug logging
        }

        const patterns = {
            codeQuality: /Code Quality:?\s*(\d+)(?:\/25)?/i,
            projectStructure: /Project Structure:?\s*(\d+)(?:\/25)?/i,
            implementation: /Implementation:?\s*(\d+)(?:\/25)?/i,
            documentation: /Documentation:?\s*(\d+)(?:\/25)?/i
        };

        for (const [key, pattern] of Object.entries(patterns)) {
            const match = analysis.match(pattern);
            if (match && match[1]) {
                const score = parseInt(match[1], 10);
                if (score >= 0 && score <= 25) {
                    scores[key] = score;
                    console.log(`Found ${key} score:`, score); // Debug logging
                }
            }
        }

        // Verify we found at least some scores
        const hasScores = Object.values(scores).some(score => score > 0);
        if (!hasScores) {
            console.log('No valid detailed scores found');
            return null;
        }

        return scores;
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