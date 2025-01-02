async function analyzeRepo() {
    const repoUrl = document.getElementById('repoUrl').value.trim();
    if (!repoUrl) {
        alert('Please enter a GitHub repository URL');
        return;
    }

    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '<div class="loading">Analyzing repository... Please wait...</div>';

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ repoUrl })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to analyze repository');
        }

        displayAnalysis(data);
        loadRecentAnalyses();

    } catch (error) {
        console.error('Analysis error:', error);
        resultDiv.innerHTML = `
            <div class="error">
                Error analyzing repository: ${error.message}
            </div>
        `;
    }
}

function displayAnalysis(data) {
    const resultDiv = document.getElementById('result');
    const analysis = data.analysis;
    
    // Handle both direct and nested analysis structures
    const detailedScores = analysis?.detailedScores || analysis?.fullAnalysis?.detailedScores || {};
    const larpScore = analysis?.larpScore || analysis?.fullAnalysis?.larpScore || 0;
    const analysisText = typeof analysis === 'string' ? analysis : 
                        typeof analysis?.fullAnalysis === 'string' ? analysis.fullAnalysis : '';
    
    // Ensure we have default values for all scores
    const scores = {
        codeQuality: detailedScores?.codeQuality || 0,
        projectStructure: detailedScores?.projectStructure || 0,
        implementation: detailedScores?.implementation || 0,
        documentation: detailedScores?.documentation || 0
    };

    // Get rating based on LARP score
    const [ratingText] = getRating(larpScore);

    resultDiv.innerHTML = `
        <div class="analysis-section">
            <div class="score-visualization">
                <div class="larp-score-display">
                    <div class="larp-score-label">LARP SCORE</div>
                    <div class="larp-score-value">${larpScore}</div>
                    <div class="larp-score-label">${ratingText}</div>
                </div>
                
                <div class="score-category">
                    <div class="score-header">
                        <span class="score-name">
                            Code Quality
                            <span class="info-tooltip" data-tooltip="Evaluates code organization, patterns, and best practices">ⓘ</span>
                        </span>
                        <span class="score-value">${scores.codeQuality}/25</span>
                    </div>
                    <div class="score-bar-container">
                        <div class="score-bar" style="width: ${(scores.codeQuality/25)*100}%"></div>
                    </div>
                </div>

                <div class="score-category">
                    <div class="score-header">
                        <span class="score-name">
                            Project Structure
                            <span class="info-tooltip" data-tooltip="Assesses project organization and architecture">ⓘ</span>
                        </span>
                        <span class="score-value">${scores.projectStructure}/25</span>
                    </div>
                    <div class="score-bar-container">
                        <div class="score-bar" style="width: ${(scores.projectStructure/25)*100}%"></div>
                    </div>
                </div>

                <div class="score-category">
                    <div class="score-header">
                        <span class="score-name">
                            Implementation
                            <span class="info-tooltip" data-tooltip="Evaluates code implementation and functionality">ⓘ</span>
                        </span>
                        <span class="score-value">${scores.implementation}/25</span>
                    </div>
                    <div class="score-bar-container">
                        <div class="score-bar" style="width: ${(scores.implementation/25)*100}%"></div>
                    </div>
                </div>

                <div class="score-category">
                    <div class="score-header">
                        <span class="score-name">
                            Documentation
                            <span class="info-tooltip" data-tooltip="Reviews code documentation and comments">ⓘ</span>
                        </span>
                        <span class="score-value">${scores.documentation}/25</span>
                    </div>
                    <div class="score-bar-container">
                        <div class="score-bar" style="width: ${(scores.documentation/25)*100}%"></div>
                    </div>
                </div>
            </div>

            ${analysisText ? marked.parse(analysisText) : '<div class="error">No analysis text available</div>'}
        </div>
    `;

    // Remove the animation code since we're setting widths directly
}

function getRating(score) {
    if (score >= 90) return ['Excellent', 'excellent'];
    if (score >= 75) return ['Good', 'good'];
    if (score >= 60) return ['Fair', 'fair'];
    return ['Poor', 'poor'];
}

function formatLarpScore(score) {
    if (score === null || score === undefined || isNaN(score)) {
        const analysisDiv = document.querySelector('.analysis-section');
        if (analysisDiv) {
            const text = analysisDiv.textContent;
            const match = text.match(/LARP Score.*?(\d+)/i);
            if (match && match[1]) {
                return parseInt(match[1], 10).toString();
            }
        }
        return 'N/A';
    }
    return score.toString();
}

async function loadRecentAnalyses() {
    try {
        const response = await fetch('/api/recent');
        const analyses = await response.json();
        
        const recentList = document.getElementById('recentList');
        recentList.innerHTML = analyses.map(repo => {
            const larpScore = repo.analysis?.larpScore;
            
            return `
                <div class="repo-card" onclick="loadAnalysis('${repo.fullName}')">
                    <h3>${repo.fullName}</h3>
                    <div class="repo-meta">
                        ${repo.description || 'No description provided'}
                        <br>
                        ${repo.language || 'Unknown'} • ${repo.stars || 0} stars
                        <br>
                        Analyzed: ${new Date(repo.lastAnalyzed).toLocaleDateString()}
                        <span class="larp-score">LARP: ${formatLarpScore(larpScore)}</span>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.repo-card').forEach(card => {
            card.addEventListener('click', function() {
                this.style.opacity = '0.7';
                setTimeout(() => this.style.opacity = '1', 200);
            });
        });
    } catch (error) {
        console.error('Failed to load recent analyses:', error);
        const recentList = document.getElementById('recentList');
        recentList.innerHTML = '<div class="error">Failed to load recent analyses</div>';
    }
}

async function loadAnalysis(fullName) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '<div class="loading">Loading analysis...</div>';
    
    try {
        const [owner, repo] = fullName.split('/');
        const response = await fetch(`/api/repository/${owner}/${repo}`);
        const data = await response.json();
        
        if (response.ok) {
            displayAnalysis({
                analysis: data.analysis
            });
            resultDiv.scrollIntoView({ behavior: 'smooth' });
        } else {
            resultDiv.innerHTML = `<div class="error">Error: ${data.error}</div>`;
        }
    } catch (error) {
        console.error('Failed to load analysis:', error);
        resultDiv.innerHTML = `<div class="error">Failed to load analysis</div>`;
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Configure marked options
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: true,
        headerPrefix: 'section-'
    });

    // Add event listeners
    const analyzeButton = document.getElementById('analyzeButton');
    if (analyzeButton) {
        analyzeButton.addEventListener('click', analyzeRepo);
    }

    const repoUrlInput = document.getElementById('repoUrl');
    if (repoUrlInput) {
        repoUrlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                analyzeRepo();
            }
        });
    }

    // Load recent analyses
    loadRecentAnalyses();
}); 