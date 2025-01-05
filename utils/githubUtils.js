const axios = require('axios');

function extractRepoInfo(url) {
    const githubRegex = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = url.match(githubRegex);
    
    if (!match) return null;
    
    return {
        owner: match[1],
        repo: match[2]
    };
}

async function getRepoDetails({ owner, repo }) {
    if (!owner || !repo) {
        throw new Error('Invalid repository info provided');
    }

    try {
        const githubToken = process.env.GITHUB_TOKEN;
        console.log(`Making GitHub API request for: ${owner}/${repo}`);
        
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: {
                Authorization: `Bearer ${githubToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });
        
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error(`Repository ${owner}/${repo} does not exist`);
        }
        throw error;
    }
}

async function getRepoContents(repoInfo, path = '', maxFiles = 50) {
    try {
        const files = [];
        const queue = [{ path }];
        
        while (queue.length > 0 && files.length < maxFiles) {
            const current = queue.shift();
            const response = await axios.get(
                `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/${current.path}`,
                {
                    headers: { 
                        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            for (const item of response.data) {
                if (item.type === 'file') {
                    // Filter relevant file types
                    if (isRelevantFile(item.name)) {
                        const content = await getFileContent(item.download_url);
                        files.push({
                            path: item.path,
                            content: content
                        });
                    }
                } else if (item.type === 'dir') {
                    queue.push({ path: item.path });
                }
            }
        }
        
        return files;
    } catch (error) {
        console.error('Error fetching repo contents:', error);
        return [];
    }
}

function isRelevantFile(filename) {
    const relevantExtensions = [
        '.js', '.ts', '.py', '.java', '.go', '.rs', '.cpp', '.c',
        '.jsx', '.tsx', '.vue', '.php', '.rb', '.sol', '.cs',
        '.html', '.css', '.scss', '.md', '.json', '.yml', '.yaml'
    ];
    
    const excludedPaths = [
        'node_modules/', 'vendor/', 'dist/', 'build/',
        'test/', 'tests/', '__tests__/', '__pycache__/',
        '.git/', '.github/', '.vscode/', '.idea/'
    ];
    
    return relevantExtensions.some(ext => filename.endsWith(ext)) &&
           !excludedPaths.some(path => filename.includes(path));
}

function parseGitHubUrl(url) {
    try {
        // Clean the URL
        url = url.trim();
        
        // Remove trailing slashes
        url = url.replace(/\/+$/, '');
        
        console.log('Cleaning URL:', url);

        // Handle HTTPS URLs
        if (url.includes('github.com')) {
            // Remove any trailing .git
            url = url.replace(/\.git$/, '');
            
            // Updated regex to be more precise
            const match = url.match(/github\.com\/([^\/\s]+)\/([^\/\s]+)/);
            
            if (!match) {
                console.log('No match found for URL:', url);
                return null;
            }

            const [, owner, repo] = match;
            
            // Clean and validate the results
            const cleanOwner = owner.trim();
            const cleanRepo = repo.trim();
            
            console.log('Parsed result:', { owner: cleanOwner, repo: cleanRepo });

            // Validate the repository exists before returning
            return {
                owner: cleanOwner,
                repo: cleanRepo
            };
        }
        return null;
    } catch (error) {
        console.error('Error parsing GitHub URL:', error);
        return null;
    }
}

async function getFileContent(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });
        // Ensure we return a string
        return typeof response.data === 'string' 
            ? response.data 
            : JSON.stringify(response.data);
    } catch (error) {
        console.error(`Error fetching file content from ${url}:`, error.message);
        return '';
    }
}

module.exports = { extractRepoInfo, getRepoDetails, getRepoContents, parseGitHubUrl, getFileContent }; 