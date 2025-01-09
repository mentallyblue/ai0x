const FULL_CA = "5M5cPVHs9K1FoNGNgp58dAFzGvU5G5fEADZHXTHwpump";
const SHORTENED_CA = FULL_CA.substring(0, 6) + "..." + FULL_CA.substring(FULL_CA.length - 4);

async function loadHeader() {
    try {
        const response = await fetch('/templates/header.html');
        const html = await response.text();
        document.body.insertAdjacentHTML('afterbegin', html);
        
        // Set up event listeners after header is loaded
        setupHeaderInteractions();
    } catch (error) {
        console.error('Failed to load header:', error);
    }
}

function setupHeaderInteractions() {
    // Set active nav link based on current page
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // Add click handler for CA copy
    const caDisplay = document.querySelector('.ca-display');
    if (caDisplay) {
        // Create the layout with icon
        caDisplay.innerHTML = `
            <span class="ca-text">${SHORTENED_CA}</span>
            <i class="fas fa-copy copy-icon"></i>
        `;
        
        // Single click handler for the entire container
        caDisplay.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                await navigator.clipboard.writeText(FULL_CA);
                showCopyNotification();
            } catch (err) {
                fallbackCopy(FULL_CA);
            }
        });
        
        // Only add hover expand on non-mobile
        if (window.innerWidth > 768) {
            caDisplay.addEventListener('mouseenter', () => {
                const textElement = caDisplay.querySelector('.ca-text');
                textElement.style.minWidth = '240px';  // Adjust based on full CA length
                setTimeout(() => {
                    textElement.textContent = FULL_CA;
                }, 150);
            });
            
            caDisplay.addEventListener('mouseleave', () => {
                const textElement = caDisplay.querySelector('.ca-text');
                textElement.textContent = SHORTENED_CA;
                textElement.style.minWidth = '80px';
            });
        }
    }

    // Add menu button click handler
    const menuBtn = document.querySelector('.menu-btn');
    if (menuBtn) {
        menuBtn.addEventListener('click', toggleMobileMenu);
    }

    // Close menu when clicking a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            const menuBtn = document.querySelector('.menu-btn');
            const navLinks = document.querySelector('.nav-links');
            menuBtn.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });
}

function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    
    try {
        textArea.select();
        document.execCommand('copy');
        showCopyNotification();
    } catch (err) {
        console.error('Failed to copy:', err);
        alert('Failed to copy CA. Please copy manually: ' + text);
    } finally {
        document.body.removeChild(textArea);
    }
}

function showCopyNotification() {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>Contract Address copied</span>
    `;
    document.body.appendChild(notification);
    
    // Remove after animation completes
    setTimeout(() => {
        notification.remove();
    }, 2000);

    // Add visual feedback to the CA display
    const caDisplay = document.querySelector('.ca-display');
    if (caDisplay) {
        caDisplay.classList.add('copied');
        setTimeout(() => {
            caDisplay.classList.remove('copied');
        }, 200);
    }
}

function toggleMobileMenu() {
    const menuBtn = document.querySelector('.menu-btn');
    const navLinks = document.querySelector('.nav-links');
    
    menuBtn.classList.toggle('active');
    navLinks.classList.toggle('active');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', loadHeader); 