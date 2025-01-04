const Anthropic = require('@anthropic-ai/sdk');
const { getRepoDetails, getRepoContents } = require('../utils/githubUtils');
const { 
    sanitizeCodeContent, 
    getFileExtension,
    extractScores,
    extractCodeReview,
    calculateTrustScore,
    calculateFinalLegitimacyScore
} = require('../utils/analysisUtils');
const { saveAnalysis } = require('./historyManager');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

async function analyzeRepo(repoInfo) {
    try {
        const repoDetails = await getRepoDetails(repoInfo);
        const codeContents = await getRepoContents(repoInfo);
        
        const analysisPrompt = `# Analysis Categories

## Code Quality (Score: [0-25]/25)
- Architecture patterns and design principles
- Code organization and modularity
- Error handling and resilience
- Performance optimization
- Best practices adherence

## Project Structure (Score: [0-25]/25)
- Directory organization
- Dependency management
- Configuration approach
- Build system
- Resource organization

## Implementation (Score: [0-25]/25)
- Core functionality implementation
- API integrations and interfaces
- Data flow and state management
- Security practices
- Code efficiency and scalability

## Documentation (Score: [0-25]/25)
- Code comments and documentation
- API documentation
- Setup instructions
- Architecture documentation
- Usage examples and guides

## Misrepresentation Checks
- Check for code authenticity
- Verify claimed features
- Validate technical claims
- Cross-reference documentation

## LARP Indicators
- Code implementation depth
- Feature completeness
- Development history
- Technical consistency

## Red Flags
- Security concerns
- Implementation issues
- Documentation gaps
- Architectural problems

## Overall Assessment
Provide a comprehensive evaluation of the project's technical merit, implementation quality, and potential risks.

## Investment Ranking (NFA)
Rating: [High/Medium/Low]
Confidence: [0-100]%
- Include key factors influencing the rating
- List major considerations
- Note potential risks and opportunities

## AI Implementation Analysis
- Identify and list any AI/ML components
- Evaluate implementation quality and correctness
- Check for misleading AI claims
- Assess model integration and usage
- Verify data processing methods
- Compare claimed vs actual AI capabilities
- Note any AI-related security concerns
- Check for proper model attribution
- Evaluate AI performance considerations

Rate the AI implementation if present:
AI Score: [0-100]
Misleading Level: [None/Low/Medium/High]
Implementation Quality: [Poor/Basic/Good/Excellent]

Provide specific examples and evidence for any AI-related findings.

# Repository Details
Repository: ${repoDetails.full_name}
Description: ${repoDetails.description || 'N/A'}
Language: ${repoDetails.language}
Stars: ${repoDetails.stargazers_count}

# Code Review
${codeContents.map(file => {
    const ext = getFileExtension(file.path);
    const sanitizedContent = sanitizeCodeContent(file.content);
    return `
File: ${file.path}
\`\`\`${ext}
${sanitizedContent}
\`\`\`
`;
}).join('\n')}

# Technical Assessment

## AI Implementation Analysis
- Identify any AI/ML components
- Verify implementation correctness
- Evaluate model integration
- Assess data processing
- Validate AI claims against code

## Logic Flow
- Core application flow
- Data processing patterns
- Control flow architecture
- Error handling paths

## Process Architecture
- System components
- Service interactions
- Scalability approach
- Integration patterns

## Code Organization Review
- Module structure
- Dependency patterns
- Code reusability
- Architecture patterns

## Critical Path Analysis
- Performance bottlenecks
- Security considerations
- Scalability challenges
- Technical debt

Provide scores as "Score: X/25" format. Include specific code examples to support findings.`;

        const analysisResponse = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            temperature: 0.3,
            messages: [{ 
                role: 'user', 
                content: `You are a technical code reviewer. Analyze this repository and provide a detailed assessment. Start directly with the scores and analysis without any introductory text.\n\n${analysisPrompt}` 
            }]
        });

        const analysis = analysisResponse.content[0].text;
        const scores = extractScores(analysis);
        const codeReview = extractCodeReview(analysis);
        const trustScore = calculateTrustScore(codeReview);
        const finalLegitimacyScore = calculateFinalLegitimacyScore(scores.legitimacyScore, trustScore);

        // Generate a more natural, informative summary
        const summaryPrompt = `Given this technical analysis, tell me what's most interesting and notable about this repository in 1-2 conversational sentences. Focus on unique features, technical achievements, or interesting implementation details. Be specific but natural in tone:

${analysis}

Remember to highlight what makes this repo special or noteworthy from a technical perspective.`;

        const summaryResponse = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 300,
            temperature: 0.7, // Higher temperature for more creative/varied responses
            messages: [{ 
                role: 'user', 
                content: summaryPrompt
            }]
        });

        const summary = summaryResponse.content[0].text.trim();

        // Save to history
        await saveAnalysis(repoDetails, {
            codeReview,
            fullAnalysis: analysis,
            trustScore,
            finalLegitimacyScore
        }, scores, summary);

        // Return complete analysis object
        return {
            repoDetails: {
                ...repoDetails,
                description: summary
            },
            analysis: {
                detailedScores: scores.detailedScores,
                legitimacyScore: scores.legitimacyScore,
                trustScore,
                finalLegitimacyScore,
                codeReview,
                fullAnalysis: analysis,
                summary
            }
        };
    } catch (error) {
        console.error('Error analyzing repository:', error);
        throw new Error(`Failed to analyze repository: ${error.message}`);
    }
}

module.exports = { analyzeRepo }; 