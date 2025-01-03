const validateGitHubUrl = (req, res, next) => {
    const { repoUrl } = req.body;
    
    // Basic GitHub URL validation
    const githubUrlPattern = /^https?:\/\/github\.com\/[\w-]+\/[\w.-]+\/?$/;
    
    if (!repoUrl || !githubUrlPattern.test(repoUrl)) {
        return res.status(400).json({
            error: 'Invalid GitHub repository URL'
        });
    }
    
    next();
};

module.exports = { validateGitHubUrl }; 