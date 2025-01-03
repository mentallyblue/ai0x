const validateGitHubUrl = (req, res, next) => {
    const { repoUrl } = req.body;
    
    // Strict GitHub URL validation
    const githubUrlPattern = /^https:\/\/github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})\/([a-zA-Z0-9_.-]{1,100})\/?$/;
    
    if (!repoUrl) {
        return res.status(400).json({
            error: 'Repository URL is required'
        });
    }

    const match = repoUrl.match(githubUrlPattern);
    if (!match) {
        return res.status(400).json({
            error: 'Invalid GitHub repository URL format'
        });
    }

    // Validate owner and repo names
    const [, owner, repo] = match;
    if (owner.length > 39 || repo.length > 100) {
        return res.status(400).json({
            error: 'Repository or owner name exceeds GitHub limits'
        });
    }

    // Add validated data to request
    req.githubRepo = {
        owner,
        repo,
        fullName: `${owner}/${repo}`
    };
    
    next();
};

module.exports = { validateGitHubUrl }; 