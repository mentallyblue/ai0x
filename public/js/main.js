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
    const analysis = data.analysis;
    
    // Better handling of nested analysis structure
    const detailedScores = analysis?.detailedScores || {
        codeQuality: 0,
        projectStructure: 0,
        implementation: 0,
        documentation: 0
    };
    
    const larpScore = analysis?.larpScore || 0;
    const analysisText = typeof analysis === 'string' ? analysis : 
                        analysis?.fullAnalysis || '';
    
    // Ensure we have valid numbers for all scores
    const scores = {
        codeQuality: Number(detailedScores.codeQuality) || 0,
        projectStructure: Number(detailedScores.projectStructure) || 0,
        implementation: Number(detailedScores.implementation) || 0,
        documentation: Number(detailedScores.documentation) || 0
    };

    // Add logging for debugging
    console.log('Analysis data:', {
        larpScore,
        detailedScores: scores,
        analysisText: analysisText.substring(0, 100) + '...' // Log first 100 chars
    });

    const [ratingText] = getRating(larpScore);

    resultDiv.innerHTML = `
        <div class="analysis-section">
            <div class="score-visualization">
                <div class="larp-score-display">
                    <div class="larp-score-label">LARP SCORE</div>
                    <div class="larp-score-value">${larpScore}</div>
                    <div class="larp-score-rating ${ratingText.toLowerCase()}">${ratingText}</div>
                </div>
                
                ${Object.entries(scores).map(([key, value]) => `
                    <div class="score-category">
                        <div class="score-header">
                            <span class="score-name">
                                ${key.replace(/([A-Z])/g, ' $1').trim()}
                                <span class="info-tooltip" data-tooltip="${getScoreTooltip(key)}">ⓘ</span>
                            </span>
                            <span class="score-value">${value}/25</span>
                        </div>
                        <div class="score-bar-container">
                            <div class="score-bar" style="width: ${(value/25)*100}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>

            ${analysisText ? marked.parse(analysisText) : '<div class="error">No analysis text available</div>'}
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