async function loadHeader() {
    try {
        const response = await fetch('/templates/header.html');
        const html = await response.text();
        document.body.insertAdjacentHTML('afterbegin', html);
    } catch (error) {
        console.error('Failed to load header:', error);
    }
}

const FULL_CA = "5M5cPVHs9K1FoNGNgp58dAFzGvU5G5fEADZHXTHwpump";

function copyCA() {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(FULL_CA).then(() => {
            showCopySuccess();
        }).catch(() => {
            fallbackCopy(FULL_CA);
        });
    } else {
        fallbackCopy(FULL_CA);
    }
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
        showCopySuccess();
    } catch (err) {
        console.error('Failed to copy:', err);
        alert('Failed to copy CA. Please copy manually: ' + text);
    } finally {
        document.body.removeChild(textArea);
    }
}

function showCopySuccess() {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = 'CA copied to clipboard!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 2000);
}

document.addEventListener('DOMContentLoaded', loadHeader); 