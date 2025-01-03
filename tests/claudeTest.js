const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const TEST_REPO_DETAILS = {
    fullName: "test/repo",
    stars: 100,
    forks: 50,
    language: "JavaScript",
    description: "Test repository for analysis"
};

const TEST_CODE_CHUNK = [
    {
        path: "index.js",
        content: `
function hello() {
    console.log("Hello World");
}

// Some AI claims
const model = {
    type: "neural-network",
    layers: ["input", "hidden", "output"]
};
        `
    }
];

async function testClaudeAnalysis() {
    const prompt = `You are a technical legitimacy auditor. Analyze this repository for technical validity, potential red flags, and investment potential (Not Financial Advice).

Repository Details:
${JSON.stringify(TEST_REPO_DETAILS, null, 2)}

Code Contents:
${JSON.stringify(TEST_CODE_CHUNK, null, 2)}

You MUST format your response EXACTLY like this template, maintaining all sections and formatting:

LEGITIMACY_SCORE: [0-100]
STATUS: [LEGITIMATE|PROMISING|QUESTIONABLE|SUSPICIOUS]

DETAILED_SCORES:
Code Reality: [0-10]
Technical Coherence: [0-10]
Implementation Legitimacy: [0-10]
Claims Assessment: [0-10]

INVESTMENT_ASSESSMENT: [INVEST|WAIT|AVOID]
RISK_LEVEL: [LOW|MEDIUM|HIGH|EXTREME]
INVESTMENT_REASONING:
[2-3 sentences explaining the investment assessment]

TECH_STACK:
- [technology1 with brief context]
- [technology2 with brief context]

RED_FLAGS:
- [specific technical concern]
- [specific implementation issue]
- [other red flags]

ANALYSIS:
1. Technical Claims Assessment:
[detailed analysis with code examples]
Score: [0-10]

2. Implementation Legitimacy:
[detailed analysis with code examples]
Score: [0-10]

3. Technical Coherence:
[detailed analysis with code examples]
Score: [0-10]

4. Documentation Assessment:
[detailed analysis]
Score: [0-10]

Instructions:
1. Replace all text in [] with actual values
2. Include specific code examples in markdown format
3. Focus on technical implementation details
4. Evaluate security and scalability concerns
5. Assess documentation completeness
6. Maintain exact formatting and section headers`;

    try {
        console.log("Sending request to Claude...");
        const response = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 4000,
            temperature: 0.1, // Lower temperature for more consistent outputs
            messages: [{ role: 'user', content: prompt }]
        });

        console.log("\nClaude's Response:\n");
        console.log(response.content[0].text);

        // Test parsing the response
        const parsed = parseAnalysisResponse(response.content[0].text);
        console.log("\nParsed Response:\n");
        console.log(JSON.stringify(parsed, null, 2));

    } catch (error) {
        console.error("Error:", error);
    }
}

// Reusing the parsing function from analyzer.js
function parseAnalysisResponse(text) {
    const legitimacyScore = parseInt(text.match(/LEGITIMACY_SCORE:\s*(\d+)/)?.[1] || 0);
    const status = text.match(/STATUS:\s*(\w+)/)?.[1] || '';
    
    const detailedScores = {
        codeQuality: 0,
        technicalCoherence: 0,
        implementation: 0,
        documentation: 0
    };

    const scoresSection = text.match(/DETAILED_SCORES:[\s\S]*?(?=\n\n)/);
    if (scoresSection) {
        const codeReality = scoresSection[0].match(/Code Reality:\s*(\d+)/)?.[1];
        const techCoherence = scoresSection[0].match(/Technical Coherence:\s*(\d+)/)?.[1];
        const implLegitimacy = scoresSection[0].match(/Implementation Legitimacy:\s*(\d+)/)?.[1];
        const claimsAssessment = scoresSection[0].match(/Claims Assessment:\s*(\d+)/)?.[1];

        detailedScores.codeQuality = parseInt(codeReality) || 0;
        detailedScores.technicalCoherence = parseInt(techCoherence) || 0;
        detailedScores.implementation = parseInt(implLegitimacy) || 0;
        detailedScores.documentation = parseInt(claimsAssessment) || 0;
    }

    return {
        legitimacyScore,
        status,
        detailedScores,
        techStack: extractList(text, 'TECH_STACK'),
        redFlags: extractList(text, 'RED_FLAGS'),
        analysis: {
            technical: extractSection(text, '1\\. Technical Claims Assessment'),
            implementation: extractSection(text, '2\\. Implementation Legitimacy'),
            coherence: extractSection(text, '3\\. Technical Coherence'),
            documentation: extractSection(text, '4\\. Documentation Assessment')
        }
    };
}

function extractList(text, section) {
    const sectionMatch = text.match(new RegExp(`${section}:([\\s\\S]*?)(?=\n\\n|$)`));
    if (!sectionMatch) return [];
    
    return sectionMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().replace(/^-\s*/, ''));
}

function extractSection(text, sectionName) {
    const sectionRegex = new RegExp(`${sectionName}:([\\s\\S]*?)(?=\\d+\\.\\s|$)`);
    const match = text.match(sectionRegex);
    if (!match) return { content: '', score: 0 };

    const scoreMatch = match[1].match(/Score:\s*(\d+)/);
    return {
        content: match[1].replace(/Score:\s*\d+/, '').trim(),
        score: scoreMatch ? parseInt(scoreMatch[1]) : 0
    };
}

// Run the test
testClaudeAnalysis(); 