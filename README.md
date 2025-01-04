<div align="center">
  <img src="public/images/image.jpg" alt="AI0x Logo" width="200" height="200" style="border-radius: 50%"/>
  <h1>AI0x - AI-Powered Market Intelligence for Code</h1>
</div>

AI0x is a real-time market intelligence platform that analyzes GitHub repositories using Claude AI to provide technical assessments and market insights. It helps identify promising projects and trends in the AI/ML ecosystem through continuous analysis and social sharing.

## Features

### Market Intelligence
- Real-time market analysis
- Project scoring and ranking
- Trend detection and analysis
- Technical strength evaluation
- Investment potential signals
- Automated market updates via Twitter

### Technical Analysis
- Comprehensive code quality assessment
- AI implementation verification
- Architecture evaluation
- Security analysis
- Documentation review
- LARP detection (Legitimacy And Reliability Profile)

### Real-time Updates
- WebSocket-based live updates
- Automated market insights
- Queue position tracking
- Analysis history
- Social sharing of insights

### Modern UI
- Dark theme optimized
- Real-time data visualization
- Analysis breakdowns
- Market trend visualization
- Mobile responsive design
- JetBrains Mono font integration

## Tech Stack

### Backend
- Node.js/Express
- Socket.IO for real-time updates
- MongoDB with Mongoose
- Claude AI (Anthropic) for analysis
- Twitter integration for market updates

### Frontend
- Vanilla JavaScript
- WebSocket integration
- Custom CSS with variables
- Responsive design system
- Markdown rendering
- Real-time data visualization

### APIs & Integration
- GitHub API for repository access
- Anthropic API for AI analysis
- Twitter API for market updates
- Custom REST API endpoints
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
   
   # Twitter Configuration
   TWITTER_USERNAME=your_twitter_username
   TWITTER_PASSWORD=your_twitter_password
   TWITTER_EMAIL=your_twitter_email
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
- `POST /api/cleanup` - Clear analysis history (admin)

## Market Intelligence Features
- Automated market analysis every hour
- Technical trend detection
- Project spotlights
- Market health scoring
- Top performer identification
- Investment signals
- Automated Twitter updates with:
  - Market insights
  - Tech trends
  - Project spotlights
  - General market thoughts

## UI Features
- Real-time market dashboard
- Analysis progress tracking
- Score visualization
- Technical breakdowns
- Repository history
- Queue position tracking
- Mobile-responsive design
- Dark theme optimization

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License
MIT

## Support
For support, please open an issue in the GitHub repository or follow us on Twitter [@ai0xdotfun](https://twitter.com/ai0xdotfun). 