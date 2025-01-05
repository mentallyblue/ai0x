<div align="center">
  <img src="public/images/image.jpg" alt="AI0x Logo" width="200" height="200" style="border-radius: 50%"/>
  <h1>AI0x - AI-Powered Market Intelligence for Code</h1>
</div>

AI0x is a real-time market intelligence platform powered by Claude AI that analyzes GitHub repositories to provide technical assessments and market insights. Our platform combines advanced code analysis with market sentiment data to deliver comprehensive project evaluations, helping identify promising technical innovations and potential risks in the rapidly evolving AI/ML ecosystem.

## Core Features

### Technical Analysis
- Repository code quality assessment (25 points)
  - Code organization and patterns
  - Error handling and resilience
  - Performance optimization
  - Best practices adherence
  - Security considerations
- Project structure evaluation (25 points)
  - Directory organization
  - Dependency management
  - Configuration approach
  - Build system
  - Resource organization
- Implementation verification (25 points)
  - Core functionality implementation
  - API integrations
  - Data flow and state management
  - Security practices
  - Code efficiency
- Documentation assessment (25 points)
  - Code comments and documentation
  - API documentation
  - Setup instructions
  - Architecture documentation
  - Usage examples

### AI Analysis
- AI implementation detection
- Technical claims verification
- Implementation quality assessment (Poor/Basic/Good/Excellent)
- Misleading level evaluation (None/Low/Medium/High)
- AI score calculation (0-100)
- Model integration verification
- Data processing validation

### Market Intelligence
- Technical legitimacy scoring (0-100)
- Risk level assessment (Low/Medium/High/Extreme)
- Implementation confidence scoring (0-100%)
- Investment rating system
- Growth potential evaluation
- Technical trend detection
- Automated social updates

### Real-time Analysis System
- WebSocket-based live updates
- Queue management system
- Analysis progress tracking
- Market data refreshes
- Social platform integration
- Queue position monitoring
- Real-time notifications

## Technical Stack

### Frontend
- HTML5/CSS3
- Vanilla JavaScript
- WebSocket integration
- Responsive design
- Real-time updates
- Mermaid.js for diagrams
- Marked.js for Markdown rendering

### Analysis Engine
- Claude 3 Sonnet (Anthropic)
- Custom scoring algorithms
- Real-time processing
- Market data analysis
- Risk assessment
- Technical verification
- Pattern detection

### Backend
- Node.js/Express
- Socket.IO
- MongoDB/Mongoose
- Bull for queue management
- Redis for caching
- Rate limiting

### Data Processing
- Queue management with Bull
- WebSocket servers (Socket.IO)
- Market data aggregation
- Social integration
- Analytics pipeline
- Real-time updates

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
   REDIS_URL=your_redis_url
   PORT=3000
   
   # Social Integration
   TWITTER_USERNAME=your_twitter_username
   TWITTER_PASSWORD=your_twitter_password
   DISCORD_WEBHOOK=your_discord_webhook
   TELEGRAM_BOT_TOKEN=your_telegram_token
   ```

4. Start the server:
   ```bash
   npm start
   ```

For development:
```bash
npm run dev
```

## API Endpoints

### Analysis
- `POST /api/analyze` - Submit repository for analysis
- `GET /api/repository/:owner/:repo` - Get repository analysis
- `GET /api/recent` - Get recent analyses
- `GET /api/analyses` - Get all analyses
- `GET /api/insights` - Get current market insights
- `GET /api/trends` - Get technical trends report

### Queue Management
- `GET /api/queue-position/:jobId` - Get position in analysis queue
- `GET /api/queue/status` - Get current queue status
- `POST /api/cleanup` - Clear analysis history

## Security

### Data Protection
- Secure WebSocket connections
- API authentication
- Express rate limiting
- Redis-based rate limiting
- Data encryption
- Access control
- Session management

### Risk Mitigation
- Input validation
- Error handling
- Audit logging
- Backup systems
- Monitoring
- Security best practices

## Social Integration

### Platform Connectivity
- X (Twitter): 
  - Market updates
  - Technical alerts
  - Trend analysis
  - Project highlights
  - Risk notifications
- Discord: 
  - Community insights
  - Real-time notifications
  - Technical discussions
  - Analysis updates
  - Market alerts
- Telegram: 
  - Market alerts
  - Project updates
  - Community engagement
  - Technical insights
  - Trend reports

## Documentation

For detailed technical information, please refer to our [Technical Whitepaper](public/whitepaper.html).

## Dependencies

Key packages:
- @anthropic-ai/sdk: ^0.14.1
- @octokit/rest: ^19.0.13
- bull: ^4.16.5
- discord.js: ^14.17.2
- express: ^4.18.2
- ioredis: ^5.4.2
- mongoose: ^8.2.0
- socket.io: ^4.8.1
- telegraf: ^4.16.3

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- GitHub Issues: For bug reports and feature requests
- Discord: Join our [community](https://discord.gg/sT4aCagN6v)
- Telegram: Join our [channel](https://t.me/ai0xportal)
- Twitter: Follow us [@ai0xdotfun](https://x.com/ai0xdotfun)

## License

This project is licensed under the MIT License
