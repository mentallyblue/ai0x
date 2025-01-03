const mongoose = require('mongoose');
const Repository = require('../models/Repository');
require('dotenv').config();

async function debugScores() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Get all repositories
        const repos = await Repository.find().sort({ lastAnalyzed: -1 });
        
        console.log('\n=== Score Analysis Debug ===\n');
        console.log(`Total repositories: ${repos.length}\n`);

        repos.forEach(repo => {
            console.log(`\nRepository: ${repo.fullName}`);
            console.log('Last analyzed:', repo.lastAnalyzed);
            console.log('\nScores:');
            console.log('- Final Legitimacy Score:', repo.analysis?.finalLegitimacyScore);
            console.log('- Technical Score:', repo.analysis?.legitimacyScore);
            console.log('- Trust Score:', repo.analysis?.trustScore);
            console.log('\nDetailed Scores:');
            console.log('- Code Quality:', repo.analysis?.detailedScores?.codeQuality);
            console.log('- Project Structure:', repo.analysis?.detailedScores?.projectStructure);
            console.log('- Implementation:', repo.analysis?.detailedScores?.implementation);
            console.log('- Documentation:', repo.analysis?.detailedScores?.documentation);
            
            // Check for potential issues
            const issues = [];
            if (!repo.analysis) issues.push('Missing analysis object');
            if (repo.analysis?.finalLegitimacyScore === undefined) issues.push('Missing finalLegitimacyScore');
            if (repo.analysis?.legitimacyScore === undefined) issues.push('Missing legitimacyScore');
            if (repo.analysis?.trustScore === undefined) issues.push('Missing trustScore');
            if (!repo.analysis?.detailedScores) issues.push('Missing detailedScores');

            if (issues.length > 0) {
                console.log('\nIssues Found:');
                issues.forEach(issue => console.log(`! ${issue}`));
            }

            console.log('\n' + '='.repeat(50));
        });

        // Summary statistics
        const stats = {
            totalRepos: repos.length,
            missingAnalysis: repos.filter(r => !r.analysis).length,
            missingFinalScore: repos.filter(r => r.analysis?.finalLegitimacyScore === undefined).length,
            missingTechnicalScore: repos.filter(r => r.analysis?.legitimacyScore === undefined).length,
            missingTrustScore: repos.filter(r => r.analysis?.trustScore === undefined).length,
            avgFinalScore: calculateAverage(repos.map(r => r.analysis?.finalLegitimacyScore)),
            avgTechnicalScore: calculateAverage(repos.map(r => r.analysis?.legitimacyScore)),
            avgTrustScore: calculateAverage(repos.map(r => r.analysis?.trustScore))
        };

        console.log('\n=== Summary Statistics ===');
        console.log(`Total Repositories: ${stats.totalRepos}`);
        console.log(`Missing Analysis: ${stats.missingAnalysis}`);
        console.log(`Missing Final Score: ${stats.missingFinalScore}`);
        console.log(`Missing Technical Score: ${stats.missingTechnicalScore}`);
        console.log(`Missing Trust Score: ${stats.missingTrustScore}`);
        console.log(`Average Final Score: ${stats.avgFinalScore}`);
        console.log(`Average Technical Score: ${stats.avgTechnicalScore}`);
        console.log(`Average Trust Score: ${stats.avgTrustScore}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

function calculateAverage(numbers) {
    const validNumbers = numbers.filter(n => n !== undefined && n !== null);
    if (validNumbers.length === 0) return 0;
    return Math.round(validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length);
}

async function debugRecentData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const recentRepos = await Repository.find()
            .sort({ lastAnalyzed: -1 })
            .limit(5);

        console.log('\n=== Recent Repositories Data Debug ===\n');
        
        recentRepos.forEach(repo => {
            console.log(`\nRepository: ${repo.fullName}`);
            console.log('Raw analysis object:', JSON.stringify(repo.analysis, null, 2));
            console.log('Scores:');
            console.log('- Final Legitimacy Score:', repo.analysis?.finalLegitimacyScore);
            console.log('- Technical Score:', repo.analysis?.legitimacyScore);
            console.log('- Trust Score:', repo.analysis?.trustScore);
            
            if (repo.analysis?.larpScore !== undefined) {
                console.log('! WARNING: Found deprecated larpScore');
            }
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function runDebug() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        await debugScores();
        await debugRecentData();

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

// Replace the direct calls with:
runDebug(); 