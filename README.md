<div align="center">
  <img src="public/images/image.jpg" alt="AI0x Logo" width="200" height="200" style="border-radius: 50%"/>
  <h1>AI0x - AI-Powered Market Intelligence for Code</h1>
</div>

AI0x is a real-time market intelligence platform powered by Claude AI that analyzes GitHub repositories to provide technical assessments and market insights. It helps identify promising projects and trends in the AI/ML ecosystem through continuous analysis and automated Twitter updates.

## Core Features

### Market Intelligence
- Real-time market health scoring (0-100)
- Project investment ratings (A+ to C)
- Risk level assessment (Low/Medium/High)
- Growth, Moat, and Timing signals
- Automated Twitter market updates every 4-8 hours
- Technical trend detection and analysis

### Technical Analysis
- Repository code quality assessment
- Implementation verification
- Architecture evaluation
- Market potential scoring
- Top performer identification
- Real-time analysis queue

### Live Updates
- WebSocket-based real-time insights
- Queue position tracking
- Automated market refreshes
- Social sharing via Twitter
- Analysis history tracking

## Tech Stack

### Backend
- Node.js/Express
- Socket.IO for real-time updates
- MongoDB/Mongoose
- Claude 3 (Anthropic) for analysis
- Twitter integration via agent-twitter-client

### Frontend
- Vanilla JavaScript
- WebSocket integration
- Custom CSS
- Real-time data visualization

### APIs
- GitHub API
- Anthropic API (Claude 3)
- Custom REST endpoints
- WebSocket events

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key
   GITHUB_TOKEN=your_github_token
   MONGODB_URI=your_mongodb_connection_string
   PORT=3000
   
   # Twitter Credentials
   TWITTER_USERNAME=your_twitter_username
   TWITTER_PASSWORD=your_twitter_password
   ```

4. Start the server:
   ```bash
   npm start
   ```

## API Endpoints

### Analysis
- `POST /api/analyze` - Submit repository for analysis
- `GET /api/repository/:owner/:repo` - Get repository analysis
- `GET /api/recent` - Get recent analyses
- `GET /api/analyses` - Get all analyses
- `GET /api/insights` - Get current market insights

### Queue Management
- `GET /api/queue-position/:jobId` - Get position in analysis queue
- `POST /api/cleanup` - Clear analysis history

## Market Intelligence Features

### Automated Analysis
- Market health score (0-100)
- Investment ratings (A+ to C)
- Risk assessments (Low/Medium/High)
- Growth/Moat/Timing signals
- Technical trend detection

### Twitter Integration
- Automated market updates (every 4-8 hours)
- Casual, human-like tweet format
- Market sentiment sharing
- Top performer highlights
- Technical trend updates

### Real-time Updates
- WebSocket-based live dashboard
- Queue position tracking
- Analysis progress monitoring
- Market insight refreshes
- Automated social sharing

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License
MIT

## Support
For support, please open an issue in the GitHub repository. 