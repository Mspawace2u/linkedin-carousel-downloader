// Injected script to bypass some LinkedIn restrictions
(function() {
    'use strict';
    
    console.log('LinkedIn Carousel Downloader: Injected script loaded');
    
    // Override some LinkedIn anti-automation measures
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        // Add custom headers to requests if needed
        if (args[1] && typeof args[1] === 'object') {
            args[1].headers = {
                ...args[1].headers,
                'User-Agent': navigator.userAgent
            };
        }
        return originalFetch.apply(this, args);
    };
    
    // Prevent detection of automated browsing
    Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
    });
    
    // Helper function to extract image URLs from LinkedIn's internal API responses
    window.extractLinkedInImages = function() {
        const images = [];
        const imageElements = document.querySelectorAll('img');
        
        imageElements.forEach(img => {
            if (img.src && img.src.includes('licdn.com') && img.src.includes('dms/image')) {
                const rect = img.getBoundingClientRect();
                if (rect.width > 200 && rect.height > 200) {
                    images.push({
                        src: img.src,
                        width: img.naturalWidth || img.width,
                        height: img.naturalHeight || img.height,
                        alt: img.alt
                    });
                }
            }
        });
        
        return images;
    };
    
    // Expose function to get high-res image URLs
    window.getHighResImageUrl = function(originalUrl) {
        let url = originalUrl;
        
        // Remove LinkedIn's size restrictions
        url = url.replace(/\/shrink_\d+_\d+\//, '/');
        url = url.replace(/&w=\d+/, '');
        url = url.replace(/&h=\d+/, '');
        
        // Try to get original size
        if (url.includes('?')) {
            url += '&q=100'; // Maximum quality
        } else {
            url += '?q=100';
        }
        
        return url;
    };
    
    // Function to bypass lazy loading
    window.triggerImageLoading = function() {
        // Scroll through the page to trigger lazy loading
        const scrollHeight = document.body.scrollHeight;
        const viewportHeight = window.innerHeight;
        let currentPosition = 0;
        
        return new Promise((resolve) => {
            function scrollStep() {
                window.scrollTo(0, currentPosition);
                currentPosition += viewportHeight / 2;
                
                if (currentPosition < scrollHeight) {
                    setTimeout(scrollStep, 100);
                } else {
                    // Scroll back to top
                    window.scrollTo(0, 0);
                    setTimeout(resolve, 500);
                }
            }
            
            scrollStep();
        });
    };
    
})();