// Simplified header.js
const FULL_CA = "5M5cPVHs9K1FoNGNgp58dAFzGvU5G5fEADZHXTHwpump";

async function loadHeader() {
    const headerHTML = `
        <header class="header">
            <div class="header-content">
                <a href="/" class="logo">
                    <img src="/images/image.jpg" alt="AI0x" class="logo-img">
                    <span class="logo-text">ai0x</span>
                </a>
                
                <div class="ca-display" title="Click to copy">
                    <span class="ca-text" data-full="${FULL_CA}">
                        ${window.innerWidth <= 768 ? FULL_CA.substring(0, 6) : FULL_CA.substring(0, 6) + '...' + FULL_CA.slice(-4)}
                    </span>
                    <svg class="copy-icon" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                </div>
                
                <nav class="nav-links">
                    <a href="/explore.html" class="nav-link">Explore</a>
                    <a href="/analysis.html" class="nav-link">Analyze</a>
                    
                    <div class="social-links">
                        <a href="https://github.com/mentallyblue/ai0x" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="social-link">
                            <svg viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                            </svg>
                        </a>
                        <a href="https://x.com/ai0xdotfun" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="social-link">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                        </a>
                        <a href="https://discord.gg/SEGtPK932Z" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="social-link">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z"/>
                            </svg>
                        </a>
                    </div>
                </nav>
            </div>
        </header>
    `;

    // Insert header at the start of body
    document.body.insertAdjacentHTML('afterbegin', headerHTML);

    // Set up CA copy functionality
    const caDisplay = document.querySelector('.ca-display');
    if (caDisplay) {
        caDisplay.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(FULL_CA);
                showCopyNotification();
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    }

    // Set active nav link
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // Add resize handler for CA text
    window.addEventListener('resize', () => {
        const caText = document.querySelector('.ca-text');
        if (caText) {
            const fullCA = caText.dataset.full;
            caText.textContent = window.innerWidth <= 768 ? 
                fullCA.substring(0, 6) : 
                fullCA.substring(0, 6) + '...' + fullCA.slice(-4);
        }
    });
}

function showCopyNotification() {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
        </svg>
        <span>Contract Address copied</span>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', loadHeader); 