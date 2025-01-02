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
                repoDetails: {
                    full_name: existingRepo.fullName,
                    description: existingRepo.description,
                    language: existingRepo.language,
                    stargazers_count: existingRepo.stars,
                    forks_count: existingRepo.forks
                },
                analysis: existingRepo.analysis,
                cached: true
            };
        }

        const repoDetails = await getRepoDetails(repoInfo);
        const codeContents = await getRepoContents(repoInfo);
        
        // Generate description if none exists
        let description = repoDetails.description;
        if (!description || description.toLowerCase() === 'no description provided') {
            description = await generateRepoDescription(codeContents);
        }

        // Create the analysis prompt
        const prompt = `Analyze this GitHub repository:

# Repository Details
Repository: ${repoDetails.full_name}
Description: ${description || 'N/A'}
Language: ${repoDetails.language}
Stars: ${repoDetails.stargazers_count}

# Technical Analysis

## Code Review
${codeContents.map(file => `
File: ${file.path}
\`\`\`${getFileExtension(file.path)}
${file.content.slice(0, 500)}${file.content.length > 500 ? '...' : ''}
\`\`\`
`).join('\n')}

## Analysis Categories

1. Code Quality Assessment
   • Architecture and patterns
   • Code organization
   • Error handling
   • Performance considerations

2. Implementation Analysis  
   • Core functionality
   • API integrations
   • Data management
   • Security practices

3. Project Structure
   • Directory organization
   • Dependency management
   • Configuration approach
   • Build system

4. Documentation Review
   • Code comments
   • API documentation
   • Setup instructions
   • Architecture docs

## Scoring

Category Scores (0-25):
1. Code Quality: [Score]
   Reason: [Detailed explanation]

2. Project Structure: [Score]
   Reason: [Detailed explanation]

3. Implementation: [Score]
   Reason: [Detailed explanation]

4. Documentation: [Score]
   Reason: [Detailed explanation]

LARP Score (0-100):
[Score] - [Detailed justification]

Rating Scale:
✅ 0-30: Exceptional
✓ 31-50: Good
⚠️ 51-70: Needs Work
❌ 71-100: Critical Issues`;

        const systemPrompt = `You are a strict technical analyzer specializing in GitHub repositories. Your analysis must be:

1. Thorough - Examine all aspects of the codebase
2. Critical - Point out both strengths and weaknesses
3. Objective - Base analysis on code, not claims
4. Detailed - Provide specific examples
5. Structured - Follow the exact format

Focus on:
• Code quality and best practices
• AI implementation accuracy
• Technical debt and scalability
• Documentation completeness
• Security considerations

Always include:
• Specific code examples for issues
• Detailed score justifications
• Concrete improvement recommendations
• Technical risk assessment`;

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            system: systemPrompt,
            messages: [{ 
                role: 'user', 
                content: prompt
            }]
        });

        // Add debug logging
        console.log('Claude Response:', response.content[0].text.substring(0, 500)); // Log first 500 chars

        const analysis = response.content[0].text;
        const summary = await generateAnalysisSummary(analysis);
        
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
            detailedScores: {
                codeQuality: detailedScores.codeQuality,
                projectStructure: detailedScores.projectStructure,
                implementation: detailedScores.implementation,
                documentation: detailedScores.documentation
            },
            techStack: extractTechStack(analysis),
            redFlags: extractRedFlags(analysis),
            aiIntegrations: codeContents.length > 0 ? detectAIIntegrations(codeContents) : [],
            codeReview: extractCodeReview(analysis),
            investmentPotential: extractInvestmentPotential(analysis),
            aiAnalysis: extractAIAnalysis(analysis),
            summary: summary
        };

        // Create or update repository record
        await Repository.findOneAndUpdate(
            { fullName: `${repoInfo.owner}/${repoInfo.repo}` },
            {
                owner: repoInfo.owner,
                repoName: repoInfo.repo,
                fullName: `${repoInfo.owner}/${repoInfo.repo}`,
                description: description,
                analysis: analysisResult,
                lastAnalyzed: Date.now(),
                language: repoDetails.language,
                stars: repoDetails.stargazers_count,
                forks: repoDetails.forks_count,
                summary: summary
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

function detectAIIntegrations(files) {
    const aiPatterns = {
        openai: /openai|gpt|davinci|completion/i,
        anthropic: /anthropic|claude/i,
        huggingface: /huggingface|transformers/i,
        tensorflow: /tensorflow|tf\./i,
        pytorch: /torch|pytorch/i
    };

    const integrations = [];
    
    files.forEach(file => {
        // Ensure content is a string
        const content = typeof file.content === 'string' 
            ? file.content 
            : String(file.content);
            
        Object.entries(aiPatterns).forEach(([provider, pattern]) => {
            if (pattern.test(content)) {
                integrations.push({
                    provider,
                    file: file.path
                });
            }
        });
    });

    return [...new Set(integrations)];
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

// Add this function to generate a description
async function generateRepoDescription(codeContents) {
    try {
        const prompt = `Analyze this repository and generate a clear, concise 1-2 sentence description of what it does:

        ${codeContents.map(f => `File: ${f.path}\n${f.content}`).join('\n\n')}`;

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 150,
            messages: [{ 
                role: 'user', 
                content: prompt
            }]
        });

        return response.content[0].text.trim();
    } catch (error) {
        console.error('Error generating description:', error);
        return 'No description available';
    }
}

function extractCodeReview(analysis) {
    try {
        const codeReview = {
            logicFlow: [],
            processArchitecture: [],
            codeOrganization: [],
            criticalPath: []
        };

        // Extract Logic Flow points
        const logicFlowSection = analysis.match(/## Logic Flow\n([\s\S]*?)(?=\n##|$)/);
        if (logicFlowSection) {
            codeReview.logicFlow = logicFlowSection[1]
                .split('\n')
                .filter(line => line.trim().startsWith('-'))
                .map(line => line.trim().replace(/^- /, ''));
        }

        // Extract Process Architecture points
        const processSection = analysis.match(/## Process Architecture\n([\s\S]*?)(?=\n##|$)/);
        if (processSection) {
            codeReview.processArchitecture = processSection[1]
                .split('\n')
                .filter(line => line.trim().startsWith('-'))
                .map(line => line.trim().replace(/^- /, ''));
        }

        // Extract Code Organization points
        const organizationSection = analysis.match(/## Code Organization Review\n([\s\S]*?)(?=\n##|$)/);
        if (organizationSection) {
            codeReview.codeOrganization = organizationSection[1]
                .split('\n')
                .filter(line => line.trim().startsWith('-'))
                .map(line => line.trim().replace(/^- /, ''));
        }

        // Extract Critical Path points
        const criticalSection = analysis.match(/## Critical Path Analysis\n([\s\S]*?)(?=\n##|$)/);
        if (criticalSection) {
            codeReview.criticalPath = criticalSection[1]
                .split('\n')
                .filter(line => line.trim().startsWith('-'))
                .map(line => line.trim().replace(/^- /, ''));
        }

        return codeReview;
    } catch (error) {
        console.error('Error extracting code review:', error);
        return null;
    }
}

// Add a function to get score color coding
function getScoreColor(score, isLarpScore = false) {
    if (isLarpScore) {
        if (score <= 30) return '🟢';
        if (score <= 50) return '🟡';
        if (score <= 70) return '🟠';
        return '🔴';
    } else {
        if (score <= 5) return '🟢';
        if (score <= 12) return '🟡';
        if (score <= 19) return '🟠';
        return '🔴';
    }
}

// Add function to extract investment potential
function extractInvestmentPotential(analysis) {
    try {
        const investmentInfo = {
            riskLevel: null,
            keyStrengths: [],
            redFlags: [],
            marketOpportunity: null,
            developmentActivity: null,
            communityEngagement: null
        };

        const section = analysis.match(/# Investment Potential.*?(?=\n#)/s);
        if (section) {
            const text = section[0];
            
            // Extract risk level
            const riskMatch = text.match(/Risk Level:\s*([High|Medium|Low]+)/);
            if (riskMatch) investmentInfo.riskLevel = riskMatch[1];

            // Extract lists
            const strengthsMatch = text.match(/Key Strengths:(.*?)(?=-|$)/s);
            if (strengthsMatch) {
                investmentInfo.keyStrengths = strengthsMatch[1]
                    .split('\n')
                    .filter(line => line.trim().startsWith('-'))
                    .map(line => line.trim().replace(/^- /, ''));
            }

            const redFlagsMatch = text.match(/Red Flags:(.*?)(?=-|$)/s);
            if (redFlagsMatch) {
                investmentInfo.redFlags = redFlagsMatch[1]
                    .split('\n')
                    .filter(line => line.trim().startsWith('-'))
                    .map(line => line.trim().replace(/^- /, ''));
            }
        }

        return investmentInfo;
    } catch (error) {
        console.error('Error extracting investment potential:', error);
        return null;
    }
}

// Enhance AI detection function
function extractAIAnalysis(analysis) {
    try {
        const aiAnalysis = {
            providers: [],
            integrationTypes: [],
            implementationQuality: null,
            transparencyRating: null,
            claimsVsReality: [],
            marketingAccuracy: null,
            userDisclosure: null
        };

        const section = analysis.match(/# AI Implementation Analysis.*?(?=\n#)/s);
        if (section) {
            const text = section[0];

            // Extract providers
            const providersMatch = text.match(/AI Providers Found:(.*?)(?=\n[A-Z])/s);
            if (providersMatch) {
                aiAnalysis.providers = providersMatch[1]
                    .split('\n')
                    .filter(line => line.trim().startsWith('-'))
                    .map(line => line.trim().replace(/^- /, ''));
            }

            // Extract transparency rating
            const transparencyMatch = text.match(/Transparency Rating:\s*([High|Medium|Low]+)/);
            if (transparencyMatch) aiAnalysis.transparencyRating = transparencyMatch[1];

            // Extract claims vs reality
            const claimsMatch = text.match(/Claims vs Reality:(.*?)(?=\n[A-Z])/s);
            if (claimsMatch) {
                aiAnalysis.claimsVsReality = claimsMatch[1]
                    .split('\n')
                    .filter(line => line.trim().startsWith('-'))
                    .map(line => line.trim().replace(/^- /, ''));
            }
        }

        return aiAnalysis;
    } catch (error) {
        console.error('Error extracting AI analysis:', error);
        return null;
    }
}

// Add function to generate summary using Claude
async function generateAnalysisSummary(analysis) {
    try {
        const prompt = `Summarize this technical analysis in 1-3 clear, concise sentences, focusing on what the project does and key findings:

        ${analysis}`;

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 150,
            messages: [{ 
                role: 'user', 
                content: prompt
            }]
        });

        return response.content[0].text.trim();
    } catch (error) {
        console.error('Error generating summary:', error);
        return null;
    }
}

module.exports = { analyzeRepo }; 