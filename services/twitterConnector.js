const AgentTwitterClient = require('agent-twitter-client');

class TwitterConnector {
    constructor(config) {
        this.config = config;
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            // Initialize the client directly
            this.client = new AgentTwitterClient({
                username: this.config.username,
                password: this.config.password,
                email: this.config.email,
                proxy: this.config.proxy || null
            });

            // Attempt to login
            await this.client.login();
            
            this.isConnected = true;
            console.log('Twitter connection established successfully');
            return true;
        } catch (error) {
            console.error('Twitter connection error:', error);
            this.isConnected = false;
            return false;
        }
    }

    async tweet(text) {
        if (!this.isConnected || !this.client) {
            throw new Error('Twitter client not connected');
        }

        try {
            const result = await this.client.tweet(text);
            return result;
        } catch (error) {
            console.error('Tweet posting error:', error);
            throw error;
        }
    }

    isLoggedIn() {
        return this.isConnected && this.client !== null;
    }
}

module.exports = TwitterConnector; 