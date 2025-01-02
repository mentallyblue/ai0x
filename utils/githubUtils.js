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
    const githubToken = process.env.GITHUB_TOKEN;
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: githubToken ? {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github.v3+json'
        } : {}
    });
    
    return response.data;
}

async function getRepoContents({ owner, repo }) {
    const githubToken = process.env.GITHUB_TOKEN;
    
    // First try to get repository details to find the default branch
    const repoResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github.v3+json'
        }
    });

    const defaultBranch = repoResponse.data.default_branch;
    
    try {
        // Try to get the tree using the default branch
        const treeResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, {
            headers: {
                Authorization: `Bearer ${githubToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });

        // Filter for code files and limit size
        const codeFiles = treeResponse.data.tree
            .filter(file => {
                const ext = file.path.split('.').pop().toLowerCase();
                return file.type === 'blob' && 
                       ['js', 'py', 'java', 'cpp', 'cs', 'php', 'rb', 'go', 'rs', 'ts'].includes(ext);
            })
            .slice(0, 5); // Limit to first 5 code files

        // Fetch content for each file
        const contents = await Promise.all(codeFiles.map(async file => {
            try {
                const contentResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`, {
                    headers: {
                        Authorization: `Bearer ${githubToken}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                });
                
                return {
                    path: file.path,
                    content: Buffer.from(contentResponse.data.content, 'base64').toString('utf-8')
                };
            } catch (error) {
                console.warn(`Failed to fetch content for ${file.path}:`, error.message);
                return {
                    path: file.path,
                    content: '// Content unavailable'
                };
            }
        }));

        return contents;
    } catch (error) {
        console.warn(`Failed to get tree from ${defaultBranch} branch:`, error.message);
        // Return empty array if we can't get contents
        return [];
    }
}

function parseGitHubUrl(url) {
    try {
        // Handle both HTTPS and SSH URLs
        const httpsRegex = /github\.com\/([^\/]+)\/([^\/\.]+)/;
        const sshRegex = /git@github\.com:([^\/]+)\/([^\/\.]+)\.git/;
        
        let match = url.match(httpsRegex) || url.match(sshRegex);
        
        if (!match) {
            throw new Error('Invalid GitHub URL format');
        }

        return {
            owner: match[1],
            repo: match[2].replace('.git', '')
        };
    } catch (error) {
        console.error('Error parsing GitHub URL:', error);
        return null;
    }
}

module.exports = { extractRepoInfo, getRepoDetails, getRepoContents, parseGitHubUrl }; 