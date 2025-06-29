// WFS&S Frontend JavaScript - Connected to https://wfs-backend.onrender.com

// Configuration
const API_BASE_URL = 'https://wfs-backend.onrender.com';

// Utility Functions
function showLoading(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.classList.add('loading');
        button.disabled = true;
    }
}

function hideLoading(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// API Request Helper
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `API Error: ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

// Stripe Checkout Handler
async function handleStripeCheckout() {
    const buttonId = 'stripeCheckoutBtn';
    
    try {
        showLoading(buttonId);
        showNotification('Redirecting to secure checkout...', 'info');
        
        // Create Stripe checkout session
        const response = await apiRequest('/api/stripe/create-checkout-session', {
            method: 'POST',
            body: JSON.stringify({
                priceId: 'price_1QWbNYBQZhEUJnVB6u5r8JjG', // Default price ID
                successUrl: `${window.location.origin}/success.html`,
                cancelUrl: `${window.location.origin}/cancel.html`
            })
        });
        
        if (response.url) {
            // Redirect to Stripe Checkout
            window.location.href = response.url;
        } else {
            throw new Error('No checkout URL received');
        }
        
    } catch (error) {
        console.error('Stripe Checkout Error:', error);
        showNotification(`Checkout Error: ${error.message}`, 'error');
        hideLoading(buttonId);
    }
}

// Stripe Identity Verification Handler
async function handleStripeIdentity() {
    const buttonId = 'stripeIdentityBtn';
    
    try {
        showLoading(buttonId);
        showNotification('Setting up identity verification...', 'info');
        
        // Create Stripe identity verification session
        const response = await apiRequest('/api/stripe/create-identity-session', {
            method: 'POST',
            body: JSON.stringify({
                returnUrl: `${window.location.origin}/identity-complete.html`
            })
        });
        
        if (response.url) {
            // Redirect to Stripe Identity
            window.location.href = response.url;
        } else {
            throw new Error('No identity verification URL received');
        }
        
    } catch (error) {
        console.error('Stripe Identity Error:', error);
        showNotification(`Identity Verification Error: ${error.message}`, 'error');
        hideLoading(buttonId);
    }
}

// Mobile Menu Handler
function toggleMobileMenu() {
    const nav = document.querySelector('.nav');
    const menuBtn = document.getElementById('mobileMenuBtn');
    
    if (nav && menuBtn) {
        nav.classList.toggle('mobile-open');
        menuBtn.classList.toggle('active');
    }
}

// Smooth Scrolling for Navigation Links
function setupSmoothScrolling() {
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetElement.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Intersection Observer for Animations
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    const animatedElements = document.querySelectorAll(
        '.service-card, .step, .hero-features .feature'
    );
    
    animatedElements.forEach(el => {
        observer.observe(el);
    });
}

// Contact Form Handler (if needed)
function setupContactForm() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            
            try {
                showNotification('Sending message...', 'info');
                
                await apiRequest('/api/contact', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                
                showNotification('Message sent successfully!', 'success');
                this.reset();
                
            } catch (error) {
                showNotification(`Error sending message: ${error.message}`, 'error');
            }
        });
    }
}

// Initialize Application
function initializeApp() {
    console.log('WFS&S Frontend initialized - Connected to:', API_BASE_URL);
    
    // Setup event listeners
    const checkoutBtn = document.getElementById('stripeCheckoutBtn');
    const checkoutBtn2 = document.getElementById('stripeCheckoutBtn2');
    const identityBtn = document.getElementById('stripeIdentityBtn');
    const identityBtn2 = document.getElementById('stripeIdentityBtn2');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    // Stripe Checkout buttons
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', handleStripeCheckout);
    }
    if (checkoutBtn2) {
        checkoutBtn2.addEventListener('click', handleStripeCheckout);
    }
    
    // Stripe Identity buttons
    if (identityBtn) {
        identityBtn.addEventListener('click', handleStripeIdentity);
    }
    if (identityBtn2) {
        identityBtn2.addEventListener('click', handleStripeIdentity);
    }
    
    // Mobile menu
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
    
    // Setup other features
    setupSmoothScrolling();
    setupScrollAnimations();
    setupContactForm();
    
    // Add loading states and error handling
    window.addEventListener('error', function(e) {
        console.error('Global error:', e.error);
        showNotification('An unexpected error occurred. Please try again.', 'error');
    });
    
    window.addEventListener('unhandledrejection', function(e) {
        console.error('Unhandled promise rejection:', e.reason);
        showNotification('Connection error. Please check your internet connection.', 'error');
    });
}

// Health Check Function
async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        
        if (data.status === 'healthy') {
            console.log('Backend connection verified:', data);
        } else {
            console.warn('Backend health check failed:', data);
        }
    } catch (error) {
        console.warn('Backend health check error:', error.message);
        showNotification('Backend connection issues detected. Some features may be limited.', 'warning');
    }
}

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    checkBackendHealth();
});

// Add notification styles dynamically
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        max-width: 400px;
        padding: 0;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        animation: slideIn 0.3s ease-out;
        background: white;
        border-left: 4px solid #DC2626;
    }
    
    .notification-content {
        padding: 1rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }
    
    .notification-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #6B7280;
        padding: 0;
        min-width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .notification-close:hover {
        color: #DC2626;
    }
    
    .notification-info {
        border-left-color: #3B82F6;
    }
    
    .notification-success {
        border-left-color: #10B981;
    }
    
    .notification-warning {
        border-left-color: #F59E0B;
    }
    
    .notification-error {
        border-left-color: #EF4444;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .mobile-open {
        display: flex !important;
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border-top: 1px solid #E5E7EB;
        padding: 1rem;
        gap: 1rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .mobile-menu-btn.active span:nth-child(1) {
        transform: rotate(45deg) translate(5px, 5px);
    }
    
    .mobile-menu-btn.active span:nth-child(2) {
        opacity: 0;
    }
    
    .mobile-menu-btn.active span:nth-child(3) {
        transform: rotate(-45deg) translate(7px, -6px);
    }
`;

// Inject notification styles
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);