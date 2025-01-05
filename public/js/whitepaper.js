document.addEventListener('DOMContentLoaded', function() {
    // Initialize mermaid with custom theme
    mermaid.initialize({
        theme: 'dark',
        securityLevel: 'loose',
        startOnLoad: true,
        themeVariables: {
            primaryColor: '#ffd700',
            primaryTextColor: '#e0e0ff',
            primaryBorderColor: '#2a2a3a',
            lineColor: '#9090a0',
            secondaryColor: '#13131f',
            tertiaryColor: '#0a0a0b'
        }
    });

    loadWhitepaper();
});

async function loadWhitepaper() {
    const content = `
# AI0x Technical Whitepaper
Version 1.0.0

## Executive Summary
AI0x is a real-time market intelligence platform powered by Claude AI that provides technical assessments and market insights for blockchain and AI/ML projects. The platform combines advanced code analysis with market sentiment to deliver comprehensive project evaluations.

## Core Architecture

### Analysis Engine
The AI0x analysis engine utilizes a multi-layered approach:

\`\`\`mermaid
graph TD
    A[Repository Input] --> B[Technical Analysis]
    B --> C[Code Quality Assessment]
    B --> D[Implementation Verification]
    B --> E[Architecture Evaluation]
    C --> F[Legitimacy Score]
    D --> F
    E --> F
    F --> G[Final Assessment]
    H[Market Data] --> G
\`\`\`

### Scoring Methodology
Our legitimacy scoring system evaluates projects across four key dimensions:

- Code Quality (25 points)
- Project Structure (25 points)
- Implementation (25 points)
- Documentation (25 points)

## Technical Components

### Real-time Analysis
- WebSocket-based live updates
- Queue management system
- Automated market refreshes
- Social platform integration

### Market Intelligence
- Repository technical assessment
- Trust score calculation
- Risk level evaluation
- Growth potential analysis

### Data Processing Pipeline
\`\`\`mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Queue
    participant Claude
    participant Analysis
    
    User->>Frontend: Submit Repository
    Frontend->>Queue: Add to Queue
    Queue->>Claude: Process Repository
    Claude->>Analysis: Generate Assessment
    Analysis->>Frontend: Return Results
\`\`\`

## Risk Assessment

### Technical Risk Matrix
<div class="risk-matrix">
    <div class="risk-category high">
        <h4>High Risk Indicators</h4>
        - Code implementation inconsistencies
        - Missing core functionality
        - Security vulnerabilities
    </div>
    <div class="risk-category medium">
        <h4>Medium Risk Indicators</h4>
        - Incomplete documentation
        - Complex dependencies
        - Limited testing coverage
    </div>
    <div class="risk-category low">
        <h4>Low Risk Indicators</h4>
        - Strong code quality
        - Comprehensive testing
        - Active development
    </div>
</div>

## Market Analysis

### Data Sources
<div class="data-sources-grid">
    <div class="source-card">
        <h4>Primary Sources</h4>
        - GitHub repositories
        - Technical documentation
        - Implementation code
    </div>
    <div class="source-card">
        <h4>Secondary Sources</h4>
        - Market sentiment
        - Development activity
        - Community engagement
    </div>
</div>

## Social Integration

### Platform Connectivity
<div class="social-platforms">
    <div class="platform-card">
        <h4>X (Twitter)</h4>
        - Automated market updates
        - Technical alerts
        - Trend analysis
    </div>
    <div class="platform-card">
        <h4>Discord</h4>
        - Community insights
        - Real-time notifications
        - Technical discussions
    </div>
    <div class="platform-card">
        <h4>Telegram</h4>
        - Market alerts
        - Project updates
        - Community engagement
    </div>
</div>

## Technical Stack

### Core Components
<div class="components-grid">
    <div class="component-card">
        <h4>Frontend</h4>
        - HTML5/CSS3
        - Vanilla JavaScript
        - WebSocket integration
    </div>
    <div class="component-card">
        <h4>Analysis</h4>
        - Claude AI
        - Custom scoring algorithms
        - Real-time processing
    </div>
    <div class="component-card">
        <h4>Data Processing</h4>
        - Queue management
        - WebSocket servers
        - Market data aggregation
    </div>
</div>
`;

    document.querySelector('.whitepaper-content').innerHTML = marked.parse(content);
    
    // Initialize mermaid diagrams after content is loaded
    mermaid.init(undefined, document.querySelectorAll('.mermaid'));
    
    // Generate table of contents
    generateTOC();
}

function generateTOC() {
    const headings = document.querySelectorAll('.whitepaper-content h2');
    const toc = document.getElementById('tableOfContents');
    
    headings.forEach(heading => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#${heading.parentElement.id}`;
        a.textContent = heading.textContent;
        li.appendChild(a);
        toc.appendChild(li);
    });
}

function toggleMobileMenu() {
    document.querySelector('.nav-links').classList.toggle('active');
} 