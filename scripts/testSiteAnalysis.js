require('dotenv').config();
const { analyzeSite } = require('../services/siteAnalyzer');

async function runTest() {
    try {
        const url = 'https://bake.is';
        console.log('Starting site analysis for:', url);
        
        const result = await analyzeSite(url);
        
        console.log('\nAnalysis Results:');
        console.log('-'.repeat(50));
        
        // Framework Detection
        console.log('\nDetected Frameworks:');
        Object.entries(result.analysis.frameworkData)
            .filter(([_, data]) => data.found)
            .forEach(([name, data]) => {
                console.log(`- ${name} (${data.confidence}% confidence)`);
                data.evidence.forEach(e => console.log(`  • ${e}`));
            });

        // Scores
        console.log('\nScores:');
        console.log(`Legitimacy: ${result.analysis.scores.legitimacyScore}`);
        console.log(`LARP: ${result.analysis.scores.larpScore}`);
        console.log(`Effort: ${result.analysis.scores.effortScore}`);
        console.log(`Risk: ${result.analysis.scores.riskScore}`);

        // Extracted Data
        console.log('\nExtracted Data:');
        console.log(result.extractedData);

        // Screenshot
        console.log('\nScreenshot URL:');
        console.log(result.screenshot);

        // Risk Factors
        console.log('\nKey Risks:');
        result.analysis.summary.keyRisks.forEach((risk, i) => {
            console.log(`${i + 1}. ${risk}`);
        });

        // Raw Analysis
        console.log('\nDetailed Analysis:');
        console.log(result.analysis.raw);

    } catch (error) {
        console.error('Test failed:', error);
    }
}

runTest(); 