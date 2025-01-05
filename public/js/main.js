async function analyzeRepo() {
    const analyzeButton = document.getElementById('analyzeButton');
    const resultDiv = document.getElementById('result');
    
    if (analyzeButton.disabled) {
        console.log('Analysis already in progress');
        return;
    }

    const repoUrl = document.getElementById('repoUrl').value.trim();
    
    if (!repoUrl) {
        alert('Please enter a GitHub repository URL');
        return;
    }

    // Disable button and show loading state
    analyzeButton.disabled = true;
    analyzeButton.classList.add('processing');
    analyzeButton.innerHTML = '<span class="spinner"></span> Processing...';
    resultDiv.innerHTML = '<div class="loading">Checking repository...</div>';

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ repoUrl })
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to analyze repository');
        }

        console.log('Analysis response:', data);

        // Handle cached results immediately
        if (data.cached && data.result) {
            console.log('Displaying cached analysis results');
            displayAnalysis(data.result);
            enableAnalyzeButton();
            return;
        }

        // For new analyses, start polling or wait for completion
        if (data.result) {
            console.log('Displaying new analysis results');
            displayAnalysis(data.result);
        } else {
            throw new Error('No analysis results received');
        }

    } catch (error) {
        console.error('Analysis error:', error);
        resultDiv.innerHTML = `
            <div class="error">
                <p>Error analyzing repository:</p>
                <p class="error-message">${error.message}</p>
                <button onclick="analyzeRepo()" class="retry-button">Retry</button>
            </div>
        `;
    } finally {
        enableAnalyzeButton();
    }
}

function enableAnalyzeButton() {
    const analyzeButton = document.getElementById('analyzeButton');
    analyzeButton.disabled = false;
    analyzeButton.classList.remove('processing');
    analyzeButton.innerHTML = 'Analyze Repository';
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
                enableAnalyzeButton(); // Re-enable on failure
                throw new Error(data.error || 'Analysis failed');
            }

            if (data.status === 'completed' && data.result) {
                enableAnalyzeButton(); // Re-enable on completion
                displayAnalysis(data.result);
                return;
            }

            // Update queue position display
            const progress = ((data.total - data.position) / data.total) * 100;
            resultDiv.innerHTML = `
                <div class="queue-status">
                    <div class="queue-position">
                        ${data.position === 0 ? 
                            '<span class="processing-badge">Processing</span>' : 
                            `Position in queue: ${data.position} of ${data.total}`
                        }
                    </div>
                    <div class="queue-progress">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div class="queue-details">
                        ${data.position === 0 ? 
                            '<span class="queue-eta">Analysis in progress...</span>' :
                            `<span class="queue-eta">Estimated wait: ${formatTime(data.position * 30)}</span>`
                        }
                    </div>
                    <div class="queue-message">
                        ${getQueueMessage(data.position)}
                    </div>
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

            ${createAIAnalysisSection(analysis.codeReview?.aiAnalysis)}

            <div class="analysis-content">
                ${marked.parse(formatAnalysisContent(analysis.fullAnalysis || 'No analysis available'))}
            </div>
        </div>
    `;
}

function createAIAnalysisSection(aiAnalysis) {
    if (!aiAnalysis || !aiAnalysis.hasAI) {
        return `
            <div class="ai-analysis-section">
                <h2>AI Implementation</h2>
                <div class="ai-status">No AI components detected in this repository</div>
            </div>
        `;
    }

    const getMisleadingClass = (level) => {
        const classes = {
            'None': 'success',
            'Low': 'warning-low',
            'Medium': 'warning-medium',
            'High': 'danger'
        };
        return classes[level] || 'neutral';
    };

    const getQualityClass = (quality) => {
        const classes = {
            'Excellent': 'success',
            'Good': 'good',
            'Basic': 'warning',
            'Poor': 'danger'
        };
        return classes[quality] || 'neutral';
    };

    return `
        <div class="ai-analysis-section">
            <h2>AI Implementation Analysis</h2>
            
            <div class="ai-metrics">
                <div class="ai-metric">
                    <span class="metric-label">AI Score</span>
                    <span class="metric-value ${getScoreClass(aiAnalysis.score)}">${aiAnalysis.score}/100</span>
                </div>
                <div class="ai-metric">
                    <span class="metric-label">Misleading Level</span>
                    <span class="metric-value ${getMisleadingClass(aiAnalysis.misleadingLevel)}">${aiAnalysis.misleadingLevel}</span>
                </div>
                <div class="ai-metric">
                    <span class="metric-label">Implementation Quality</span>
                    <span class="metric-value ${getQualityClass(aiAnalysis.implementationQuality)}">${aiAnalysis.implementationQuality}</span>
                </div>
            </div>

            ${aiAnalysis.components.length > 0 ? `
                <div class="ai-components">
                    <h3>AI Components</h3>
                    <ul class="component-list">
                        ${aiAnalysis.components.map(comp => `<li>${comp}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            ${aiAnalysis.concerns.length > 0 ? `
                <div class="ai-concerns">
                    <h3>Concerns</h3>
                    <ul class="concern-list">
                        ${aiAnalysis.concerns.map(concern => `<li class="concern-item">${concern}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
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
        console.log('Starting to load recent analyses...');
        const response = await fetch('/api/recent');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const analyses = await response.json();
        console.log('Recent analyses data:', analyses);
        
        const recentList = document.getElementById('recentList');
        console.log('Found recentList element:', !!recentList);
        
        if (!recentList) {
            console.error('Could not find #recentList element in the DOM');
            return;
        }

        // Create the HTML string
        const analysesHTML = analyses.map(repo => {
            console.log('Creating card for repo:', repo.fullName);
            return `
                <div class="repo-card" 
                     data-repo="${repo.fullName}" 
                     style="cursor: pointer;">
                    <h3>${repo.fullName}</h3>
                    <p>${repo.description || 'No description available'}</p>
                    <div class="repo-meta">
                        <span class="language">${repo.language || 'Unknown'}</span>
                        <span class="stars">⭐ ${repo.stars || 0}</span>
                    </div>
                    <div class="analysis-time">
                        Analyzed: ${new Date(repo.lastAnalyzed).toLocaleString()}
                    </div>
                </div>
            `;
        }).join('');

        // Set the innerHTML
        recentList.innerHTML = `
            <div class="recent-analyses">
                ${analysesHTML}
            </div>
        `;

        // Add click handlers after the content is loaded
        document.querySelectorAll('.repo-card').forEach(card => {
            card.addEventListener('click', function(e) {
                const repoName = this.dataset.repo;
                if (repoName) {
                    console.log('Navigating to analysis for:', repoName);
                    window.location.href = `/analysis.html?repo=${encodeURIComponent(repoName)}`;
                }
            });
        });

    } catch (error) {
        console.error('Failed to load recent analyses:', error);
        const recentList = document.getElementById('recentList');
        if (recentList) {
            recentList.innerHTML = `
                <div class="error">
                    Failed to load recent analyses: ${error.message}
                </div>
            `;
        }
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
    console.log('DOM Content Loaded - Initializing...');
    loadRecentAnalyses();
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

    // Add this function to handle clicks on repo cards
    initializeRepoCardClicks();
    
    // Also add MutationObserver to handle dynamically added cards
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                initializeRepoCardClicks();
            }
        });
    });

    // Start observing the recentList element for changes
    const recentList = document.getElementById('recentList');
    if (recentList) {
        observer.observe(recentList, { childList: true, subtree: true });
    }
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
    const historyContainer = document.getElementById('recent-analyses');
    if (!historyContainer) return;

    historyContainer.innerHTML = analyses.map(analysis => `
        <div class="analysis-item" data-repo="${analysis.repoDetails.full_name}">
            <h3 class="repo-name">${analysis.repoDetails.full_name}</h3>
            <p class="analysis-summary">${analysis.analysis.summary || 'No summary available'}</p>
            <div class="score-container">
                <span class="score">Trust Score: ${analysis.analysis.trustScore.toFixed(2)}</span>
                <span class="score">Legitimacy: ${analysis.analysis.finalLegitimacyScore.toFixed(2)}</span>
            </div>
        </div>
    `).join('');

    // Add click handlers to all analysis items
    document.querySelectorAll('.analysis-item').forEach(item => {
        item.addEventListener('click', function() {
            const repoName = this.dataset.repo;
            if (repoName) {
                window.location.href = `/analysis.html?repo=${encodeURIComponent(repoName)}`;
            }
        });
    });
}

// Add some CSS to make it clear items are clickable
const style = document.createElement('style');
style.textContent = `
    .analysis-item {
        cursor: pointer;
        transition: background-color 0.2s ease;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 10px;
    }

    .analysis-item:hover {
        background-color: rgba(0, 0, 0, 0.05);
    }
`;
document.head.appendChild(style);

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

// Update the queue status header with global information
function updateQueueHeader(queueData) {
    const queueStatusHeader = document.getElementById('queueStatusHeader');
    if (!queueStatusHeader) return;

    const { size, processing, waiting, status } = queueData;
    const statusClass = status === 'offline' ? 'queue-offline' : 
                       size > 0 ? 'queue-active' : 'queue-idle';
    
    queueStatusHeader.innerHTML = `
        <div class="queue-status-content ${statusClass}">
            <div class="queue-stats">
                <span class="queue-count">Queue: ${size || 0}</span>
                <div class="queue-details">
                    ${processing ? `<span class="processing-count">${processing} active</span>` : ''}
                    ${waiting ? `<span class="waiting-count">${waiting} waiting</span>` : ''}
                    ${!processing && !waiting ? '<span class="waiting-count">No active jobs</span>' : ''}
                </div>
            </div>
            <span class="queue-indicator"></span>
        </div>
    `;
}

// Update socket.io connection handler
try {
    const socket = io();
    window.activeJobId = null; // Track active job ID globally
    
    socket.on('connect', () => {
        console.log('Connected to queue updates');
        // Request initial queue state
        socket.emit('requestQueueState');
    });

    socket.on('queueUpdate', (data) => {
        // Ensure we have default values if any property is undefined
        const queueData = {
            size: data.size || 0,
            processing: data.processing || 0,
            waiting: data.waiting || 0,
            positions: data.positions || {}
        };
        
        updateQueueHeader(queueData);
        
        // If there's an active job, update its display
        if (window.activeJobId) {
            updateActiveJobDisplay(queueData);
        }
    });

    socket.on('analysisComplete', (data) => {
        // Update recent analyses when any analysis completes
        updateRecentAnalyses();
        
        // If it's our analysis, display it
        if (data.jobId === window.activeJobId) {
            displayAnalysis(data.result);
            window.activeJobId = null;
            enableAnalyzeButton();
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from queue updates');
        updateQueueHeader({
            size: 0,
            processing: 0,
            waiting: 0,
            status: 'offline'
        });
    });
} catch (error) {
    console.error('Socket.IO initialization error:', error);
}

// Add function to update active job display
function updateActiveJobDisplay(queueData) {
    const resultDiv = document.getElementById('result');
    const position = queueData.positions[window.activeJobId];
    
    if (position !== undefined) {
        const progress = ((queueData.size - position) / queueData.size) * 100;
        resultDiv.innerHTML = `
            <div class="queue-status">
                <div class="queue-position">
                    ${position === 0 ? 
                        '<span class="processing-badge">Processing</span>' : 
                        `Position in queue: ${position} of ${queueData.size}`
                    }
                </div>
                <div class="queue-progress">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                </div>
                <div class="queue-details">
                    ${position === 0 ? 
                        '<span class="queue-eta">Analysis in progress...</span>' :
                        `<span class="queue-eta">Estimated wait: ${formatTime(position * 30)}</span>`
                    }
                </div>
                <div class="queue-message">
                    ${getQueueMessage(position)}
                </div>
            </div>
        `;
    }
}

// Add function to update recent analyses
async function updateRecentAnalyses() {
    try {
        const response = await fetch('/api/recent');
        const analyses = await response.json();
        
        const recentList = document.getElementById('recentList');
        if (!recentList) return;

        recentList.innerHTML = analyses.map(analysis => `
            <div class="repo-card">
                <h3>${analysis.fullName}</h3>
                <p>${analysis.description || 'No description available'}</p>
                <div class="repo-meta">
                    ${analysis.language ? `<span class="language">${analysis.language}</span>` : ''}
                    <span class="stars">⭐ ${analysis.stars || 0}</span>
                </div>
                <div class="analysis-time">
                    Analyzed: ${new Date(analysis.lastAnalyzed).toLocaleString()}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error updating recent analyses:', error);
    }
}

// Call updateRecentAnalyses initially
document.addEventListener('DOMContentLoaded', updateRecentAnalyses);

function formatTime(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes} minute${minutes > 1 ? 's' : ''}`;
}

function getQueueMessage(position) {
    if (position === 0) {
        return 'We are analyzing your repository. This may take a few minutes...';
    }
    const messages = [
        'Thank you for your patience!',
        'We\'ll notify you when the analysis is ready.',
        'Analyzing repositories thoroughly takes time.',
        'Get ready for a detailed analysis!'
    ];
}

function showToast(message) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    // Remove toast after 5 seconds
    setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) {
            container.remove();
        }
    }, 5000);
}

// Add this function to handle clicks on repo cards
function initializeRepoCardClicks() {
    const repoCards = document.querySelectorAll('.repo-card');
    repoCards.forEach(card => {
        card.addEventListener('click', function() {
            // Extract repo name from the h3 element
            const repoName = this.querySelector('h3').textContent;
            if (repoName) {
                console.log('Clicked repo:', repoName);
                window.location.href = `/analysis.html?repo=${encodeURIComponent(repoName)}`;
            }
        });
        // Add cursor pointer to make it clear it's clickable
        card.style.cursor = 'pointer';
    });
}

function copyCA() {
    const caAddress = document.getElementById('caAddress').textContent;
    navigator.clipboard.writeText(caAddress).then(() => {
        showToast('CA copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy CA');
    });
} 