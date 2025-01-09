const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function checkRepositorySimilarity(repoFullName) {
    try {
        const [owner, repo] = repoFullName.split('/');
        
        // Get repository details
        const { data: repoData } = await octokit.repos.get({
            owner,
            repo
        });

        // Get creation date and last push
        const createdAt = new Date(repoData.created_at);
        const lastPush = new Date(repoData.pushed_at);
        const daysSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);

        // Get commit history
        const { data: commits } = await octokit.repos.listCommits({
            owner,
            repo,
            per_page: 100
        });

        // Red flags
        const flags = [];

        // Check for suspicious patterns
        if (commits.length === 1) {
            flags.push("Single commit repository - possible direct copy");
        }

        if (daysSinceCreation < 7 && commits.length > 50) {
            flags.push("High commit count for new repository - possible bulk import");
        }

        // Check commit patterns
        const commitTimes = commits.map(c => new Date(c.commit.author.date).getTime());
        const timeDiffs = [];
        for (let i = 1; i < commitTimes.length; i++) {
            timeDiffs.push(commitTimes[i-1] - commitTimes[i]);
        }

        // Check for unnaturally consistent commit intervals
        const avgDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
        const allSimilar = timeDiffs.every(diff => Math.abs(diff - avgDiff) < 1000 * 60 * 5); // 5 minutes
        if (allSimilar && commits.length > 10) {
            flags.push("Suspiciously consistent commit intervals");
        }

        // Check for bulk file additions
        const { data: contents } = await octokit.repos.getContent({
            owner,
            repo,
            path: ''
        });

        if (contents.length > 50 && commits.length < 5) {
            flags.push("Large number of files with few commits");
        }

        // Search for similar repositories
        const { data: similar } = await octokit.search.repos({
            q: `created:<${repoData.created_at} ${repoData.description || repo}`,
            sort: 'stars',
            per_page: 5
        });

        // Check for very similar repositories that are older
        const similarRepos = similar.items.filter(r => 
            r.full_name !== repoFullName && 
            r.stargazers_count > repoData.stargazers_count
        );

        if (similarRepos.length > 0) {
            flags.push(`Similar older repositories found: ${similarRepos.map(r => r.full_name).join(', ')}`);
        }

        return {
            flags,
            riskLevel: flags.length > 2 ? 'high' : flags.length > 0 ? 'medium' : 'low',
            similarRepos: similarRepos.map(r => ({
                name: r.full_name,
                stars: r.stargazers_count,
                created: r.created_at
            }))
        };

    } catch (error) {
        console.error('Error checking repository similarity:', error);
        return {
            flags: ['Error checking repository'],
            riskLevel: 'unknown',
            similarRepos: []
        };
    }
}

module.exports = { checkRepositorySimilarity }; 