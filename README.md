# AI0x - GitHub Repository Analyzer

An AI-powered code analysis tool that evaluates GitHub repositories and provides comprehensive technical assessments using Claude AI.

## Features
- LARP Score (Legitimacy and Reliability Profile)
- Detailed scoring across multiple categories:
  - Code Quality (25 points)
  - Project Structure (25 points)
  - Implementation (25 points)
  - Documentation (25 points)
- Real-time analysis queue tracking
- WebSocket-based status updates
- Comprehensive repository analysis including:
  - AI implementation detection
  - Technical architecture review
  - Code organization assessment
  - Critical path analysis
- MongoDB-based caching and history
- Recent analyses feed
- Responsive web interface
- Rate limiting protection

## Tech Stack
- Backend:
  - Node.js/Express
  - Socket.IO for real-time updates
  - Bull for queue management
  - MongoDB with Mongoose
  - Redis for queue management and rate limiting
- AI Integration:
  - Claude AI (Anthropic) for code analysis
- Frontend:
  - Vanilla JavaScript
  - WebSocket integration
  - Responsive CSS
- APIs:
  - GitHub API for repository access
  - Custom REST API endpoints

## Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up required services:
   - MongoDB instance
   - Redis server (for queue management)

4. Create `.env` file with required configuration:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key
   GITHUB_TOKEN=your_github_token
   MONGODB_URI=your_mongodb_connection_string
   REDIS_URL=your_redis_url
   PORT=3000 # Optional, defaults to 3000
   NODE_ENV=development # or production
   ```

5. Start the server:
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

## API Endpoints
- `GET /api/recent` - Get recent analyses
- `GET /api/repository/:owner/:repo` - Get specific repository analysis
- `POST /api/analyze` - Submit repository for analysis
- `GET /api/analyses` - Get all analyses
- `GET /api/queue-position/:jobId` - Get position in analysis queue
- `POST /api/cleanup` - Clear analysis history (admin only)

## Rate Limiting
The API includes rate limiting to prevent abuse:
- Express rate limiter
- Redis-based rate limiting storage
- Configurable limits per endpoint

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