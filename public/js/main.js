async function analyzeRepo() {
    const repoUrl = document.getElementById('repoUrl').value.trim();
    if (!repoUrl) {
        alert('Please enter a GitHub repository URL');
        return;
    }

    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '<div class="loading">Adding to analysis queue...</div>';

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

        if (!data || !data.jobId) {
            throw new Error('Invalid response from server');
        }

        console.log('Successfully queued analysis with jobId:', data.jobId);
        pollQueuePosition(data.jobId);

    } catch (error) {
        console.error('Analysis error:', error);
        resultDiv.innerHTML = `
            <div class="error">
                <p>Error analyzing repository:</p>
                <p class="error-message">${error.message}</p>
                <button onclick="analyzeRepo()" class="retry-button">Retry</button>
            </div>
        `;
    }
}

async function pollQueuePosition(jobId) {
    const resultDiv = document.getElementById('result');
    
    const checkPosition = async () => {
        try {
            const response = await fetch(`/api/queue-position/${jobId}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to check queue position');
            }

            if (data.status === 'failed') {
                throw new Error(data.error || 'Analysis failed');
            }

            if (data.status === 'completed' && data.result) {
                // Analysis completed
                displayAnalysis(data.result);
                return;
            }

            // Update queue position display
            const progress = ((data.total - data.position) / data.total) * 100;
            resultDiv.innerHTML = `
                <div class="queue-status">
                    <div class="queue-position">Position in queue: ${data.position}</div>
                    <div class="queue-progress">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div class="queue-message">Please wait while we analyze your repository...</div>
                </div>
            `;

            // Continue polling
            setTimeout(checkPosition, 2000);
        } catch (error) {
            console.error('Queue position error:', error);
            resultDiv.innerHTML = `
                <div class="error">
                    <p>Error: ${error.message}</p>
                    <button onclick="analyzeRepo()" class="retry-button">Retry Analysis</button>
                </div>
            `;
        }
    };

    // Start polling
    checkPosition();
}

function displayAnalysis(data) {
    const resultDiv = document.getElementById('result');
    const analysis = data?.analysis || {};
    
    resultDiv.innerHTML = `
        <div class="analysis-result">
            <div class="score-overview">
                <div class="legitimacy-score-display ${getScoreClass(analysis.finalLegitimacyScore)}">
                    <span class="score-value">${analysis.finalLegitimacyScore || 0}</span>
                    <span class="score-label">Legitimacy Score</span>
                    <div class="score-breakdown">
                        <div class="score-detail">Technical: ${analysis.legitimacyScore || 0}</div>
                        <div class="score-detail">Trust: ${analysis.trustScore || 0}</div>
                    </div>
                </div>
                
                <div class="score-grid">
                    ${createDetailedScoreCard('Code Quality', analysis.detailedScores?.codeQuality)}
                    ${createDetailedScoreCard('Project Structure', analysis.detailedScores?.projectStructure)}
                    ${createDetailedScoreCard('Implementation', analysis.detailedScores?.implementation)}
                    ${createDetailedScoreCard('Documentation', analysis.detailedScores?.documentation)}
                </div>
            </div>

            <div class="analysis-content">
                ${marked.parse(formatAnalysisContent(analysis.fullAnalysis || 'No analysis available'))}
            </div>
        </div>
    `;
}

function formatAnalysisContent(content) {
    // Add proper spacing and formatting for bullet points
    return content
        .replace(/•/g, '→')  // Replace bullet points with arrows
        .replace(/\n\n/g, '\n\n\n') // Add extra spacing between sections
        .replace(/#{1,6} /g, match => `\n\n${match}`); // Add spacing before headers
}

function createDetailedScoreCard(title, score) {
    const rating = getRating(score || 0);
    return `
        <div class="score-card ${rating[1]}">
            <div class="score-header">
                <span class="score-title">${title}</span>
                <span class="score-number">${score || 0}/25</span>
            </div>
            <div class="score-bar">
                <div class="score-fill" style="width: ${(score || 0) * 4}%"></div>
            </div>
        </div>
    `;
}

// Helper function for score tooltips
function getScoreTooltip(scoreType) {
    const tooltips = {
        codeQuality: "Evaluates code organization, patterns, and best practices",
        projectStructure: "Assesses project organization and architecture",
        implementation: "Evaluates code implementation and functionality",
        documentation: "Reviews code documentation and comments"
    };
    return tooltips[scoreType] || "";
}

function getRating(score) {
    if (score <= 30) return ['Exceptional', 'exceptional'];
    if (score <= 50) return ['Good', 'good'];
    if (score <= 70) return ['Needs Improvement', 'needs-improvement'];
    return ['Critical Issues', 'critical'];
}

function formatLegitimacyScore(score) {
    if (score === null || score === undefined || isNaN(score)) {
        return 'N/A';
    }
    return score.toString();
}

async function loadRecentAnalyses() {
    try {
        const response = await fetch('/api/recent');
        const analyses = await response.json();
        
        console.log('Recent analyses data:', analyses);
        
        const recentList = document.getElementById('recentList');
        recentList.innerHTML = `<h2>Recent Analyses</h2>` + analyses.map(repo => {
            return `
                <div class="repo-card" onclick="loadAnalysis('${repo.fullName}')">
                    <h3>${repo.fullName}</h3>
                    <div class="repo-meta">
                        ${repo.description || 'No description provided'}
                        <br>
                        ${repo.language || 'Unknown'} • ${repo.stars || 0} stars
                        <br>
                        Analyzed: ${new Date(repo.lastAnalyzed).toLocaleDateString()}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Failed to load recent analyses:', error);
        const recentList = document.getElementById('recentList');
        recentList.innerHTML = '<div class="error">Failed to load recent analyses</div>';
    }
}

async function loadAnalysis(repoFullName) {
    try {
        const [owner, repo] = repoFullName.split('/');
        const response = await fetch(`/api/repository/${owner}/${repo}`);
        const data = await response.json();
        
        console.log('Loading analysis for', repoFullName, data);
        
        if (data && data.analysis) {
            // Only pass repo name for the title
            const params = new URLSearchParams({
                repo: repoFullName
            });
            window.location.href = `/analysis.html?${params.toString()}`;
        } else {
            throw new Error('Analysis not found');
        }
    } catch (error) {
        console.error('Failed to load analysis:', error);
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    let socket;
    try {
        socket = io({
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000
        });

        const queueStatusHeader = document.getElementById('queueStatusHeader');
        
        socket.on('connect', () => {
            console.log('Socket connected successfully');
            if (queueStatusHeader) {
                queueStatusHeader.innerHTML = '<span class="queue-count">Queue: Connected</span>';
            }
        });

        socket.on('queueUpdate', (data) => {
            if (queueStatusHeader) {
                queueStatusHeader.innerHTML = `<span class="queue-count">Queue: ${data.size}</span>`;
            }
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            if (queueStatusHeader) {
                queueStatusHeader.innerHTML = '<span class="queue-count">Queue: Offline</span>';
            }
        });
    } catch (error) {
        console.error('Socket.IO initialization error:', error);
        if (queueStatusHeader) {
            queueStatusHeader.innerHTML = '<span class="queue-count">Queue: Offline</span>';
        }
    }

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

// Add helper functions for score classes
function getScoreClass(score) {
    if (score === null || score === undefined || isNaN(score)) {
        return 'score-unknown';
    }
    const numScore = Number(score);
    if (numScore >= 80) return 'score-exceptional';
    if (numScore >= 60) return 'score-good';
    if (numScore >= 40) return 'score-needs-improvement';
    return 'score-critical';
}

function getDetailedScoreClass(score) {
    if (score <= 5) return 'score-exceptional';
    if (score <= 12) return 'score-good';
    if (score <= 19) return 'score-needs-improvement';
    return 'score-critical';
}

// Helper functions for new sections
function getRiskClass(risk) {
    if (!risk) return 'risk-unknown';
    return `risk-${risk.toLowerCase()}`;
}

function getTransparencyClass(transparency) {
    if (!transparency) return 'transparency-unknown';
    return `transparency-${transparency.toLowerCase()}`;
}

function renderList(title, items) {
    if (!items || items.length === 0) return '';
    return `
        <div class="info-list">
            <h4>${title}</h4>
            <ul>
                ${items.map(item => `<li>${item}</li>`).join('')}
            </ul>
        </div>
    `;
}

function displayRecentAnalyses(analyses) {
    const recentDiv = document.getElementById('recentAnalyses');
    if (!recentDiv || !analyses.length) return;

    recentDiv.innerHTML = `
        <h2>Recent Analyses</h2>
        <div class="recent-grid">
            ${analyses.map(analysis => {
                const legitimacyScore = analysis.analysis?.finalLegitimacyScore ?? 
                                      analysis.analysis?.legitimacyScore ?? 
                                      (analysis.analysis?.larpScore ?? 0);
                
                return `
                    <div class="recent-card ${getScoreClass(legitimacyScore)}">
                        <div class="recent-header">
                            <h3>${analysis.fullName}</h3>
                            <span class="recent-score">${legitimacyScore}</span>
                        </div>
                        <div class="recent-description">
                            ${analysis.description || 'No description available'}
                        </div>
                        <div class="recent-summary">
                            ${analysis.summary || 'Analysis summary not available'}
                        </div>
                        <div class="recent-meta">
                            <span class="tech-tag">${analysis.language || 'Unknown'}</span>
                            <span class="tech-tag">⭐ ${analysis.stars || 0}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Update the score range constants
const SCORE_RANGES = {
    '0-30': 'Exceptional',
    '31-50': 'Good',
    '51-70': 'Needs Improvement',
    '71-100': 'Critical'
};

// Update sorting function
function sortAnalyses(analyses, sortBy) {
    return analyses.sort((a, b) => {
        switch (sortBy) {
            case 'date':
                return new Date(b.lastAnalyzed) - new Date(a.lastAnalyzed);
            case 'score':
                const scoreA = a.analysis?.finalLegitimacyScore ?? Number.MAX_VALUE;
                const scoreB = b.analysis?.finalLegitimacyScore ?? Number.MAX_VALUE;
                return scoreA - scoreB;
            case 'stars':
                return (b.stars || 0) - (a.stars || 0);
            default:
                return 0;
        }
    });
}

// Update displayAnalyses function to show cards properly
function displayAnalyses(analyses) {
    const grid = document.getElementById('analysisGrid');
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageAnalyses = analyses.slice(start, end);

    grid.innerHTML = pageAnalyses.map(analysis => {
        const repoName = analysis.fullName;
        // Remove old larpScore reference and use finalLegitimacyScore directly
        const legitimacyScore = analysis.analysis?.finalLegitimacyScore || 0;
        const technicalScore = analysis.analysis?.legitimacyScore || 0;
        const trustScore = analysis.analysis?.trustScore || 0;
        
        return `
            <div class="analysis-card ${getScoreClass(legitimacyScore)}" 
                 onclick="window.location.href='/analysis.html?repo=${analysis.fullName}'">
                <div class="recent-header">
                    <h3 class="repo-name">${analysis.fullName}</h3>
                    <span class="recent-score">${legitimacyScore}</span>
                </div>
                <div class="recent-description">
                    ${analysis.description || 'No description available'}
                </div>
                <div class="recent-summary">
                    ${analysis.summary || 'Analysis summary not available'}
                </div>
                <div class="score-summary">
                    <div class="score-row">
                        <span class="score-label">Legitimacy Score</span>
                        <span class="score-value ${getScoreClass(legitimacyScore)}">${legitimacyScore}</span>
                    </div>
                    <div class="score-row">
                        <span class="score-label">Technical Score</span>
                        <span class="score-value">${technicalScore}</span>
                    </div>
                    <div class="score-row">
                        <span class="score-label">Trust Score</span>
                        <span class="score-value">${trustScore}</span>
                    </div>
                </div>
                <div class="tech-tags">
                    <span class="tech-tag">${analysis.language || 'Unknown'}</span>
                    <span class="tech-tag">⭐ ${analysis.stars || 0}</span>
                    <span class="tech-tag">🔄 ${analysis.forks || 0}</span>
                </div>
            </div>
        `;
    }).join('');
} 