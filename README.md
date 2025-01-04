<div align="center">
  <img src="public/images/image.jpg" alt="AI0x Logo" width="200" height="200" style="border-radius: 50%"/>
  <h1>AI0x - GitHub Repository Analyzer</h1>
</div>

An AI-powered code analysis tool that evaluates GitHub repositories and provides comprehensive technical assessments using Claude AI. AI0x helps identify legitimate projects by analyzing code quality, implementation details, and potential red flags.

## Features
- LARP Score (Legitimacy and Reliability Profile)
- Detailed scoring across multiple categories:
  - Code Quality (25 points)
  - Technical Implementation (25 points)
  - Project Structure (25 points)
  - Documentation (25 points)
- Real-time analysis with WebSocket updates
- Comprehensive repository analysis including:
  - AI implementation detection
  - Technical architecture review
  - Code organization assessment
  - Critical path analysis
  - Security vulnerability scanning
- Modern UI with:
  - Dark theme
  - Responsive design
  - Real-time queue status
  - Analysis history
  - Score visualization
  - Detailed technical breakdowns
- Performance optimized:
  - MongoDB-based caching
  - Redis queue management
  - Rate limiting protection
  - WebSocket status updates

## Tech Stack
### Backend
- Node.js/Express
- Socket.IO for real-time updates
- Bull for queue management
- MongoDB with Mongoose
- Redis for queue/cache management
- Claude AI (Anthropic) for analysis

### Frontend
- Vanilla JavaScript
- WebSocket integration
- Custom CSS with CSS Variables
- Responsive design system
- JetBrains Mono font
- Markdown rendering

### APIs & Integration
- GitHub API for repository access
- Custom REST API endpoints
- WebSocket events
- Rate limiting middleware

## Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up required services:
   - MongoDB instance
   - Redis server
   - Anthropic API access

4. Create `.env` file:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key
   GITHUB_TOKEN=your_github_token
   MONGODB_URI=your_mongodb_connection_string
   REDIS_URL=your_redis_url
   PORT=3000
   NODE_ENV=development
   ```

5. Start the server:
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## API Endpoints

### Analysis
- `POST /api/analyze` - Submit repository for analysis
- `GET /api/repository/:owner/:repo` - Get repository analysis
- `GET /api/recent` - Get recent analyses
- `GET /api/analyses` - Get all analyses

### Queue Management
- `GET /api/queue-position/:jobId` - Get queue position
- `GET /api/queue-status` - Get current queue status
- `POST /api/cleanup` - Clear analysis history (admin)

## UI Features
- Real-time analysis progress tracking
- Score visualization with animations
- Technical breakdown sections
- Repository history cards
- Queue position indicator
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
For support, please open an issue in the GitHub repository or reach out on Twitter [@ai0xdotfun](https://x.com/ai0xdotfun). 