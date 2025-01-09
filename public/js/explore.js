async function loadRepositories() {
    try {
        const grid = document.getElementById('repositoriesGrid');
        grid.innerHTML = '<div class="loading">Loading repositories...</div>';

        const response = await fetch('/api/analyses');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || 'Failed to fetch repositories');
        }

        const data = await response.json();
        if (!data || !Array.isArray(data)) {
            throw new Error('Invalid data received from server');
        }

        allRepositories = data;
        currentPage = 1;
        applyFilters();

        // Update stats
        document.getElementById('totalAnalyses').textContent = data.length;
        updateStats(data);
    } catch (error) {
        console.error('Load error:', error);
        document.getElementById('repositoriesGrid').innerHTML = `
            <div class="error">
                <h3>Failed to load repositories</h3>
                <p>${error.message}</p>
                <button onclick="loadRepositories()" class="retry-button">
                    Try Again
                </button>
            </div>
        `;
    }
}

function updateStats(data) {
    // Calculate average score
    const avgScore = data.reduce((acc, repo) => 
        acc + (repo.analysis?.legitimacyScore || 0), 0) / data.length;
    document.getElementById('avgScore').textContent = 
        avgScore ? Math.round(avgScore) : 0;

    // Find most common language
    const languages = data.reduce((acc, repo) => {
        if (repo.language) {
            acc[repo.language] = (acc[repo.language] || 0) + 1;
        }
        return acc;
    }, {});
    
    const topLanguage = Object.entries(languages)
        .sort(([,a], [,b]) => b - a)[0];
    
    document.getElementById('topLanguage').textContent = 
        topLanguage ? topLanguage[0] : 'N/A';
}

function showMobileAnalysis(repoFullName) {
    if (window.innerWidth <= 768) {
        const container = document.querySelector('.container');
        container.classList.add('mobile-fullscreen');
        
        // Add back button
        const backButton = document.createElement('button');
        backButton.className = 'back-button';
        backButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
            Close
        `;
        
        backButton.addEventListener('click', () => {
            container.classList.remove('mobile-fullscreen');
            backButton.remove();
            // Clear the analysis and show the repository list
            document.getElementById('result').innerHTML = '';
            loadRepositories();
        });
        
        document.body.appendChild(backButton);
    }
}

// Update the repository click handler
function handleRepositoryClick(repoFullName) {
    showMobileAnalysis(repoFullName);
    loadAnalysis(repoFullName);
    // Update URL without page reload
    history.pushState({}, '', `/analysis.html?repo=${repoFullName}`);
} 