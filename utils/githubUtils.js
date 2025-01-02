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
    
    // First get the tree
    const treeResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
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
        .slice(0, 5); // Limit to first 5 code files to avoid token limits

    // Fetch content for each file
    const contents = await Promise.all(codeFiles.map(async file => {
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
    }));

    return contents;
}

module.exports = { extractRepoInfo, getRepoDetails, getRepoContents }; 