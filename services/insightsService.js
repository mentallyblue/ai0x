const Repository = require('../models/Repository');
const { Octokit } = require('@octokit/rest');
const vectorStore = require('./vectorStoreService');
const { Anthropic } = require('@anthropic-ai/sdk');

class InsightsService {
    constructor() {
        this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        this.anthropic = new Anthropic();
    }

    async generateInsights(repoFullName) {
        try {
            const [owner, repo] = repoFullName.split('/');
            
            // Parallel fetch all data we need
            const [
                repoData,
                commits,
                issues,
                pullRequests,
                contributors,
                languages
            ] = await Promise.all([
                this.octokit.repos.get({ owner, repo }),
                this.octokit.repos.listCommits({ owner, repo, per_page: 100 }),
                this.octokit.issues.listForRepo({ owner, repo, state: 'all', per_page: 100 }),
                this.octokit.pulls.list({ owner, repo, state: 'all', per_page: 100 }),
                this.octokit.repos.listContributors({ owner, repo, per_page: 100 }),
                this.octokit.repos.listLanguages({ owner, repo })
            ]);

            // Calculate activity metrics
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);

            const recentCommits = commits.data.filter(commit => 
                new Date(commit.commit.author.date) > lastMonth
            );

            const recentIssues = issues.data.filter(issue => 
                new Date(issue.created_at) > lastMonth
            );

            const recentPRs = pullRequests.data.filter(pr => 
                new Date(pr.created_at) > lastMonth
            );

            // Enhanced insights object
            const insights = {
                basic: {
                    stars: repoData.data.stargazers_count,
                    forks: repoData.data.forks_count,
                    watchers: repoData.data.subscribers_count,
                    size: repoData.data.size,
                    defaultBranch: repoData.data.default_branch,
                    license: repoData.data.license?.name || 'No license',
                },
                activity: {
                    totalCommits: commits.data.length,
                    recentCommits: recentCommits.length,
                    totalIssues: issues.data.length,
                    openIssues: repoData.data.open_issues_count,
                    recentIssues: recentIssues.length,
                    totalPRs: pullRequests.data.length,
                    recentPRs: recentPRs.length,
                    lastUpdated: repoData.data.updated_at,
                    contributors: contributors.data.length,
                },
                technical: {
                    codeQuality: this.calculateCodeQuality(repoData, commits),
                    architectureScore: this.evaluateArchitecture(repoData),
                    testCoverage: await this.analyzeTestCoverage(owner, repo),
                    dependencies: await this.analyzeDependencies(owner, repo),
                    securityScore: await this.calculateSecurityScore(owner, repo)
                },
                market: {
                    trendingScore: this.calculateTrendingScore({
                        repoData: repoData.data,
                        recentCommits: recentCommits.length,
                        recentIssues: recentIssues.length,
                        recentPRs: recentPRs.length
                    }),
                    competitorAnalysis: await this.analyzeCompetitors(repoFullName),
                    communityHealth: this.calculateCommunityHealth({
                        issues: issues.data,
                        pullRequests: pullRequests.data,
                        contributors: contributors.data,
                        recentActivity: recentCommits.length
                    }),
                    growthMetrics: this.calculateGrowthMetrics(commits.data, repoData.data.stargazers_count)
                },
                aiAnalysis: await this.generateEnhancedAIAnalysis(insights, repoFullName)
            };

            // Store in vector database
            await vectorStore.storeRepoInsights(repoFullName, insights);

            // Find similar repositories
            const similarRepos = await vectorStore.findSimilarRepos(repoFullName);
            insights.similarRepos = similarRepos;

            // Store complete insights in MongoDB
            await Repository.findOneAndUpdate(
                { fullName: repoFullName },
                { 
                    $set: { 
                        insights,
                        lastInsightUpdate: new Date()
                    }
                },
                { upsert: true }
            );

            return insights;
        } catch (error) {
            console.error('Error generating insights:', error);
            throw error;
        }
    }

    async generateAIAnalysis(insights, repoFullName) {
        const prompt = `Analyze this GitHub repository (${repoFullName}) data and provide detailed insights:
        
        1. What makes this repository stand out?
        2. What are its strengths and potential areas for improvement?
        3. What patterns or best practices are evident?
        4. What recommendations would you make?
        5. Are there any security or performance concerns?
        
        Repository Data: ${JSON.stringify(insights, null, 2)}`;

        const response = await this.anthropic.messages.create({
            model: "claude-3-sonnet-20240229",
            max_tokens: 2048,
            messages: [{
                role: "user",
                content: prompt
            }]
        });

        return {
            summary: response.content,
            timestamp: new Date()
        };
    }

    async generateTrendsReport() {
        // Get patterns analysis from vector store
        const patterns = await vectorStore.analyzePatterns();

        // Generate comprehensive report
        const reportPrompt = `Based on these patterns in GitHub repositories, generate a detailed trend report: ${patterns}`;

        const response = await this.anthropic.messages.create({
            model: "claude-3-sonnet-20240229",
            max_tokens: 3072,
            messages: [{
                role: "user",
                content: reportPrompt
            }]
        });

        return {
            trends: response.content,
            patterns: patterns,
            timestamp: new Date()
        };
    }

    calculateTrendingScore({ repoData, recentCommits, recentIssues, recentPRs }) {
        const now = new Date();
        const lastUpdate = new Date(repoData.updated_at);
        const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24);

        // Weight recent activity more heavily
        const activityScore = (
            recentCommits * 3 + 
            recentIssues * 2 + 
            recentPRs * 2
        );

        // Base score from stars and forks
        const baseScore = (
            repoData.stargazers_count * 2 + 
            repoData.forks_count * 3
        );

        // Combine scores with time decay
        return Math.round((baseScore + activityScore) / (daysSinceUpdate + 1));
    }

    calculateHealthScore({ hasDescription, hasLicense, hasReadme, issuesEnabled, wikiEnabled }) {
        let score = 0;
        const total = 5; // Total number of checks

        if (hasDescription) score++;
        if (hasLicense) score++;
        if (hasReadme) score++;
        if (issuesEnabled) score++;
        if (wikiEnabled) score++;

        return (score / total) * 100;
    }

    calculatePRMergeRate(prs) {
        const merged = prs.filter(pr => pr.merged_at).length;
        return prs.length > 0 ? (merged / prs.length) * 100 : 0;
    }

    calculateAvgIssueTime(issues) {
        const closedIssues = issues.filter(issue => issue.closed_at);
        if (closedIssues.length === 0) return 0;

        const totalTime = closedIssues.reduce((sum, issue) => {
            const created = new Date(issue.created_at);
            const closed = new Date(issue.closed_at);
            return sum + (closed - created);
        }, 0);

        return Math.round(totalTime / closedIssues.length / (1000 * 60 * 60 * 24)); // Convert to days
    }

    async generateEnhancedAIAnalysis(insights, repoFullName) {
        const prompt = `Analyze this GitHub repository (${repoFullName}) and provide detailed insights in the following categories:

        1. Technical Implementation
        2. Market Potential
        3. Community & Growth
        4. Security & Quality
        5. Competitive Analysis
        6. Investment Signals
        
        Repository Data: ${JSON.stringify(insights, null, 2)}`;

        const response = await this.anthropic.messages.create({
            model: "claude-3-sonnet-20240229",
            max_tokens: 3072,
            messages: [{
                role: "user", 
                content: prompt
            }]
        });

        return {
            summary: response.content,
            categories: this.parseAIResponse(response.content),
            timestamp: new Date()
        };
    }

    calculateCommunityHealth({ issues, pullRequests, contributors, recentActivity }) {
        const metrics = {
            issueResolutionRate: this.calculateIssueResolutionRate(issues),
            prAcceptanceRate: this.calculatePRAcceptanceRate(pullRequests),
            contributorGrowth: this.calculateContributorGrowth(contributors),
            activityLevel: this.normalizeActivityScore(recentActivity)
        };

        return {
            score: this.aggregateHealthMetrics(metrics),
            details: metrics
        };
    }
}

module.exports = new InsightsService(); 