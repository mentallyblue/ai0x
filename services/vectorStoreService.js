const mongoose = require('mongoose');
const { Anthropic } = require('@anthropic-ai/sdk');
const anthropic = new Anthropic();

// Define a schema for vector storage
const vectorSchema = new mongoose.Schema({
    repoFullName: String,
    vector: [Number],  // Store embeddings as array of numbers
    metadata: {
        stars: Number,
        languages: [String],
        healthScore: Number,
        trendingScore: Number,
        timestamp: Date
    }
});

// Create vector model
const VectorModel = mongoose.model('Vector', vectorSchema);

class VectorStoreService {
    async storeRepoInsights(repoFullName, insights) {
        try {
            // Convert insights into embeddings using Claude
            const embedding = await this.generateEmbedding(insights);
            
            // Store in MongoDB
            await VectorModel.findOneAndUpdate(
                { repoFullName },
                {
                    vector: embedding,
                    metadata: {
                        stars: insights.basic.stars,
                        languages: Object.keys(insights.languages),
                        healthScore: insights.healthScore,
                        trendingScore: insights.trendingScore,
                        timestamp: new Date()
                    }
                },
                { upsert: true }
            );

            console.log(`Stored vectors for ${repoFullName}`);
        } catch (error) {
            console.error('Error storing repo insights:', error);
            throw error;
        }
    }

    async generateEmbedding(insights) {
        try {
            // Convert insights to a structured text representation
            const textRepresentation = this.insightsToText(insights);
            
            // Use Claude to generate a numerical representation
            const response = await anthropic.messages.create({
                model: "claude-3-sonnet-20240229",
                max_tokens: 1024,
                messages: [{
                    role: "user",
                    content: `Convert this repository data into a numerical vector representation with 384 dimensions, suitable for similarity search. Only return the array of numbers, nothing else: ${textRepresentation}`
                }]
            });

            // Parse the response into an array of numbers
            const vectorString = response.content.trim();
            const vector = JSON.parse(vectorString);
            
            return vector;
        } catch (error) {
            console.error('Error generating embedding:', error);
            throw error;
        }
    }

    insightsToText(insights) {
        return `
            Repository Stats:
            Stars: ${insights.basic.stars}
            Forks: ${insights.basic.forks}
            Languages: ${Object.keys(insights.languages).join(', ')}
            Recent Commits: ${insights.activity.recentCommits}
            Health Score: ${insights.healthScore}
            Trending Score: ${insights.trendingScore}
            Contributors: ${insights.activity.contributors}
        `;
    }

    async findSimilarRepos(repoFullName, limit = 5) {
        try {
            // Get the vector for the target repo
            const targetRepo = await VectorModel.findOne({ repoFullName });
            if (!targetRepo) {
                throw new Error('Repository not found in vector store');
            }

            // Find similar repos using vector similarity
            const similarRepos = await VectorModel.aggregate([
                {
                    $search: {
                        knnBeta: {
                            vector: targetRepo.vector,
                            path: "vector",
                            k: limit
                        }
                    }
                },
                {
                    $project: {
                        repoFullName: 1,
                        metadata: 1,
                        score: { $meta: "searchScore" }
                    }
                }
            ]);

            return similarRepos;
        } catch (error) {
            console.error('Error finding similar repos:', error);
            throw error;
        }
    }

    async analyzePatterns() {
        try {
            // Get recent repositories
            const recentRepos = await VectorModel.find()
                .sort({ 'metadata.timestamp': -1 })
                .limit(100);

            // Use Claude to analyze patterns
            const analysis = await anthropic.messages.create({
                model: "claude-3-sonnet-20240229",
                max_tokens: 2048,
                messages: [{
                    role: "user",
                    content: `Analyze these repositories and identify interesting patterns, trends, and notable insights: ${JSON.stringify(recentRepos)}`
                }]
            });

            return analysis.content;
        } catch (error) {
            console.error('Error analyzing patterns:', error);
            throw error;
        }
    }
}

module.exports = new VectorStoreService(); 