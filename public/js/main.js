document.addEventListener('DOMContentLoaded', async function() {
    const socket = io();
    let currentAnalysis = null;

    // Load recent analyses and most recent analysis for placeholder
    async function loadRecentAnalyses() {
        try {
            const response = await fetch('/api/recent-analyses');
            
            // Check if response is ok before trying to parse JSON
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data && data.analyses && data.analyses.length > 0) {
                // Update recent list
                displayRecentList(data.analyses);
                
                // Display most recent analysis in the placeholder
                const mostRecent = data.analyses[0];
                displayAnalysis(mostRecent, 'lastAnalysis');
            } else {
                document.getElementById('lastAnalysis').innerHTML = `
                    <div class="no-analysis">
                        <p>No analyses yet. Start by analyzing a repository!</p>
                    </div>
                `;
                document.getElementById('recentList').innerHTML = `
                    <div class="no-analysis">
                        <p>No recent analyses</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load recent analyses:', error);
            const errorMessage = error.message.includes('Failed to fetch') ? 
                'Unable to connect to server' : 
                'Failed to load recent analyses';
            
            document.getElementById('recentList').innerHTML = `
                <div class="error">
                    <p>${errorMessage}</p>
                    <p class="error-details">Please try again later</p>
                </div>
            `;
            document.getElementById('lastAnalysis').innerHTML = `
                <div class="error">
                    <p>${errorMessage}</p>
                    <p class="error-details">Please try again later</p>
                </div>
            `;
        }
    }

    // Display analysis results in a specified container
    function displayAnalysis(data, containerId = 'result') {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Create repository header
        const repoHeader = `
            <div class="repo-header">
                <div class="repo-title">
                    <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    <h2>${data.repoFullName}</h2>
                </div>
                <div class="repo-stats">
                    <span title="Stars">⭐ ${data.stars || 0}</span>
                    <span title="Forks">🔄 ${data.forks || 0}</span>
                    <span title="Language">${data.language || 'Unknown'}</span>
                </div>
            </div>
            <div class="score-summary">
                <div class="score-item">
                    <span class="score-label">Legitimacy Score</span>
                    <span class="score-value">${data.analysis?.legitimacyScore || 'N/A'}</span>
                </div>
                <div class="score-item">
                    <span class="score-label">Trust Score</span>
                    <span class="score-value">${data.analysis?.trustScore || 'N/A'}</span>
                </div>
            </div>`;

        // Convert markdown to HTML for the analysis content
        const analysisContent = marked.parse(data.analysis?.fullAnalysis || data.analysis || '');

        container.innerHTML = `
            ${repoHeader}
            <div class="analysis-content">
                ${analysisContent}
            </div>
        `;
    }

    // Display recent analyses list
    function displayRecentList(analyses) {
        const recentList = document.getElementById('recentList');
        if (!recentList) return;

        const recentHtml = analyses.map(analysis => `
            <div class="analysis-card" data-repo="${analysis.repoFullName}">
                <h3>${analysis.repoFullName}</h3>
                <p class="timestamp">${new Date(analysis.timestamp).toLocaleString()}</p>
            </div>
        `).join('');

        recentList.innerHTML = `<div class="recent-grid">${recentHtml}</div>`;

        // Add click handlers for analysis cards
        document.querySelectorAll('.analysis-card').forEach(card => {
            card.addEventListener('click', () => {
                window.location.href = `/analysis.html?repo=${card.dataset.repo}`;
            });
        });
    }

    // Handle repository analysis
    async function analyzeRepository(repoUrl) {
        try {
            // Extract owner and repo from URL
            const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
            if (!match) {
                throw new Error('Invalid GitHub repository URL');
            }

            const [, owner, repo] = match;
            document.getElementById('result').innerHTML = '<div class="loading">Analyzing repository...</div>';

            // Start analysis
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner, repo })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Analysis failed');
            }

            // Redirect to analysis page
            window.location.href = `/analysis.html?repo=${owner}/${repo}`;

        } catch (error) {
            document.getElementById('result').innerHTML = `
                <div class="error">
                    ${error.message || 'Failed to analyze repository'}
                </div>
            `;
        }
    }

    // Event Listeners
    document.getElementById('analyzeButton').addEventListener('click', () => {
        const repoUrl = document.getElementById('repoUrl').value.trim();
        if (repoUrl) {
            analyzeRepository(repoUrl);
        }
    });

    document.getElementById('repoUrl').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const repoUrl = e.target.value.trim();
            if (repoUrl) {
                analyzeRepository(repoUrl);
            }
        }
    });

    // Socket.io event handlers
    socket.on('analysisProgress', (data) => {
        if (currentAnalysis === data.id) {
            document.getElementById('result').innerHTML = `
                <div class="loading">
                    ${data.message || 'Analyzing repository...'}
                </div>
            `;
        }
    });

    // Load initial data
    loadRecentAnalyses();
}); 