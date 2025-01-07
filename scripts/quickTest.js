require('dotenv').config();
const { analyzeSite } = require('../services/siteAnalyzer');

async function testSiteAnalysis() {
    const url = 'https://bake.is';
    console.log(`\nAnalyzing ${url}...`);
    console.log('='.repeat(50));
    
    try {
        const result = await analyzeSite(url);
        
        // Print Framework Detection
        if (result.analysis?.frameworkData) {
            console.log('\nFrameworks Detected:');
            Object.entries(result.analysis.frameworkData)
                .filter(([_, data]) => data.found)
                .forEach(([name, data]) => {
                    console.log(`- ${name} (${data.confidence}% confident)`);
                    if (data.evidence.length > 0) {
                        console.log('  Evidence:');
                        data.evidence.forEach(e => console.log(`    • ${e}`));
                    }
                });
        }

        // Print Scores
        if (result.analysis?.scores) {
            console.log('\nRisk Analysis:');
            const scores = result.analysis.scores;
            Object.entries(scores).forEach(([key, value]) => {
                console.log(`${key}: ${value}/100`);
            });
        }

        // Print Summary
        if (result.analysis?.summary) {
            console.log('\nSummary:');
            const summary = result.analysis.summary;
            console.log('Verdict:', summary.verdict);
            console.log('Risk Level:', summary.riskLevel);
            console.log('Trust Score:', summary.trustScore);
            
            if (summary.keyRisks?.length > 0) {
                console.log('\nKey Risks:');
                summary.keyRisks.forEach((risk, i) => {
                    console.log(`${i + 1}. ${risk}`);
                });
            }
        }

        // Print Tech Stack
        if (result.analysis?.techStack?.length > 0) {
            console.log('\nDetected Technologies:');
            result.analysis.techStack.forEach((tech, i) => {
                console.log(`${i + 1}. ${tech}`);
            });
        }

    } catch (error) {
        console.error('Analysis failed:', error.message);
        if (error.stack) {
            console.error('\nStack trace:', error.stack);
        }
    }
}

testSiteAnalysis().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
}); 