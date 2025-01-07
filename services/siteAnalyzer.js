const Anthropic = require('@anthropic-ai/sdk');
const { extractScores, calculateTrustScore, calculateFinalLegitimacyScore } = require('../utils/analysisUtils');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

async function analyzeSiteContent(scrapeData) {
    try {
        const analysisPrompt = `# Site Analysis Categories

## Technical Implementation (Score: [0-25]/25)
- Frontend frameworks and libraries
- Performance optimization
- Code quality and organization
- Error handling and resilience

## Security & Infrastructure (Score: [0-25]/25)
- Security headers and protocols
- SSL/TLS implementation
- Access controls
- Data protection measures

## SEO & Accessibility (Score: [0-25]/25)
- Meta information
- Search engine optimization
- Accessibility standards
- Mobile responsiveness

## Content & Structure (Score: [0-25]/25)
- Information architecture
- Content organization
- User experience
- Navigation design

## Red Flags
- Security vulnerabilities
- Performance issues
- Accessibility problems
- UX concerns

## Overall Assessment
Provide a comprehensive evaluation of the site's technical implementation, security, and user experience.

# Site Details
URL: ${scrapeData.metadata.sourceURL}
Title: ${scrapeData.metadata.title}
Description: ${scrapeData.metadata.description}

# Technical Review
HTML Content Sample:
\`\`\`html
${scrapeData.html.substring(0, 1500)}...
\`\`\`

Metadata:
${JSON.stringify(scrapeData.metadata, null, 2)}

# Analysis Points

## Technology Stack
- Identify frameworks and libraries
- Evaluate implementation quality
- Assess build optimization
- Check for best practices

## Security Analysis
- Review security headers
- Check SSL configuration
- Evaluate access controls
- Identify vulnerabilities

## Performance Review
- Load time indicators
- Resource optimization
- Caching implementation
- Mobile performance

## SEO & Accessibility
- Meta tags implementation
- Schema markup
- ARIA compliance
- Mobile friendliness

Provide scores as "Score: X/25" format. Include specific examples to support findings.`;

        const analysisResponse = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            temperature: 0.3,
            messages: [{ 
                role: 'user', 
                content: `You are a technical website analyzer. Analyze this site data and provide a detailed assessment. Start directly with the scores and analysis without any introductory text.\n\n${analysisPrompt}` 
            }]
        });

        const analysis = analysisResponse.content[0].text;
        const scores = extractScores(analysis);
        const trustScore = calculateTrustScore({
            redFlags: analysis.match(/## Red Flags\n([\s\S]*?)(?=\n##|$)/)?.[1]?.split('\n').filter(line => line.trim().startsWith('-')) || [],
            larpIndicators: [],
            misrepresentationChecks: [],
            aiAnalysis: { misleadingLevel: 'None', concerns: [] }
        });

        const finalScore = calculateFinalLegitimacyScore(scores.legitimacyScore, trustScore);

        return {
            success: true,
            analysis: {
                detailedScores: scores.detailedScores,
                legitimacyScore: scores.legitimacyScore,
                trustScore,
                finalScore,
                fullAnalysis: analysis,
                metadata: scrapeData.metadata,
                technologies: detectTechnologies(scrapeData.html),
                performance: analyzePerformance(scrapeData),
                security: analyzeSecurityFeatures(scrapeData.metadata),
                seo: analyzeSEO(scrapeData.metadata),
                accessibility: analyzeAccessibility(scrapeData.html)
            }
        };
    } catch (error) {
        console.error('Error analyzing site:', error);
        throw error;
    }
}

function detectTechnologies(html) {
    const techs = [];
    if (html.includes('react')) techs.push({ name: 'React', confidence: 'High' });
    if (html.includes('next')) techs.push({ name: 'Next.js', confidence: 'High' });
    if (html.includes('vue')) techs.push({ name: 'Vue.js', confidence: 'High' });
    if (html.includes('angular')) techs.push({ name: 'Angular', confidence: 'High' });
    if (html.includes('tailwind')) techs.push({ name: 'Tailwind CSS', confidence: 'High' });
    if (html.includes('bootstrap')) techs.push({ name: 'Bootstrap', confidence: 'High' });
    return techs;
}

function analyzePerformance(data) {
    return {
        pageSize: data.html.length,
        resourceCount: {
            images: (data.html.match(/<img/g) || []).length,
            scripts: (data.html.match(/<script/g) || []).length,
            styles: (data.html.match(/<link.*?rel="stylesheet"/g) || []).length
        },
        loadTime: 'Analyzed on request',
        mobileFriendly: true
    };
}

function analyzeSecurityFeatures(metadata) {
    return {
        ssl: true,
        headers: {
            csp: !!metadata['content-security-policy'],
            hsts: !!metadata['strict-transport-security'],
            xframe: !!metadata['x-frame-options']
        },
        robotsPolicy: metadata.robots || 'Not specified'
    };
}

function analyzeSEO(metadata) {
    return {
        title: {
            present: !!metadata.title,
            length: metadata.title?.length || 0
        },
        description: {
            present: !!metadata.description,
            length: metadata.description?.length || 0
        },
        openGraph: !!metadata['og:title'],
        twitterCards: !!metadata['twitter:card']
    };
}

function analyzeAccessibility(html) {
    const score = calculateAccessibilityScore(html);
    return {
        score,
        rating: getAccessibilityRating(score),
        checks: {
            altTexts: html.includes('alt='),
            ariaLabels: html.includes('aria-'),
            semanticHtml: html.includes('<nav') || html.includes('<main') || html.includes('<header')
        }
    };
}

function calculateAccessibilityScore(html) {
    let score = 70;
    if (html.includes('alt=')) score += 10;
    if (html.includes('aria-')) score += 10;
    if (html.includes('<nav') || html.includes('<main')) score += 10;
    return Math.min(100, score);
}

function getAccessibilityRating(score) {
    if (score >= 90) return { label: 'Excellent', icon: '🟢' };
    if (score >= 70) return { label: 'Good', icon: '🟡' };
    if (score >= 50) return { label: 'Needs Improvement', icon: '🟠' };
    return { label: 'Poor', icon: '🔴' };
}

module.exports = { analyzeSiteContent }; 