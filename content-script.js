// Content script for LinkedIn carousel extraction
console.log('LinkedIn Carousel Downloader: Content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractCarouselData') {
        extractCarouselData(request.options)
            .then(data => sendResponse({ success: true, data }))
            .catch(error => {
                console.error('Error extracting carousel data:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep message channel open for async response
    }
});

async function extractCarouselData(options) {
    console.log('Starting carousel data extraction...');
    
    // Wait for page to fully load
    await waitForPageLoad();
    
    // Find the carousel container
    const carouselData = await findCarouselImages();
    
    if (!carouselData.images || carouselData.images.length === 0) {
        throw new Error('No carousel images found. Please make sure this is a LinkedIn carousel post.');
    }
    
    // Extract post content
    const postContent = extractPostContent();
    
    // Extract creator information
    const creatorInfo = extractCreatorInfo();
    
    console.log(`Found ${carouselData.images.length} carousel images`);
    
    return {
        images: carouselData.images,
        postContent,
        creatorInfo,
        postUrl: window.location.href
    };
}

async function waitForPageLoad() {
    return new Promise((resolve) => {
        if (document.readyState === 'complete') {
            setTimeout(resolve, 1000); // Additional wait for dynamic content
        } else {
            window.addEventListener('load', () => {
                setTimeout(resolve, 1000);
            });
        }
    });
}

async function findCarouselImages() {
    const images = [];
    let carouselContainer = null;
    
    // Multiple selectors to find carousel containers
    const carouselSelectors = [
        '[data-finite-scroll-hotkey-item]',
        '.scaffold-finite-scroll__content',
        '.feed-shared-update-v2',
        '.share-update-card',
        '[data-id]'
    ];
    
    // Find the main post container
    for (const selector of carouselSelectors) {
        carouselContainer = document.querySelector(selector);
        if (carouselContainer) break;
    }
    
    if (!carouselContainer) {
        console.log('Trying to find images in the entire document...');
    }
    
    // Look for carousel indicators or multiple images
    const imageSelectors = [
        'img[src*="media-exp"]', // LinkedIn media images
        'img[src*="licdn.com"]', // LinkedIn CDN images
        '.carousel-image img',
        '.feed-shared-image img',
        '.update-components-image img',
        'img[alt*="carousel"]',
        '.feed-shared-update-v2 img',
        'img[src*="dms/image"]' // LinkedIn document/image URLs
    ];
    
    const searchContainer = carouselContainer || document;
    const foundImages = new Set();
    
    for (const selector of imageSelectors) {
        const imgs = searchContainer.querySelectorAll(selector);
        imgs.forEach(img => {
            if (isValidCarouselImage(img)) {
                foundImages.add({
                    src: getHighResImageUrl(img.src),
                    alt: img.alt || '',
                    width: img.naturalWidth || img.width,
                    height: img.naturalHeight || img.height
                });
            }
        });
    }
    
    // Convert Set to Array
    const imageArray = Array.from(foundImages);
    
    // If we still don't have images, try a more aggressive approach
    if (imageArray.length === 0) {
        console.log('No images found with standard selectors, trying aggressive search...');
        const allImages = document.querySelectorAll('img');
        allImages.forEach(img => {
            if (isCarouselPostImage(img)) {
                imageArray.push({
                    src: getHighResImageUrl(img.src),
                    alt: img.alt || '',
                    width: img.naturalWidth || img.width,
                    height: img.naturalHeight || img.height
                });
            }
        });
    }
    
    return { images: imageArray };
}

function isValidCarouselImage(img) {
    const src = img.src;
    const minSize = 200; // Minimum size to filter out small images
    
    // Check if it's a LinkedIn media image
    if (!src.includes('licdn.com') && !src.includes('media-exp')) {
        return false;
    }
    
    // Filter out profile pictures, icons, and small images
    if (src.includes('profile-displayphoto') || 
        src.includes('company-logo') || 
        src.includes('icon') ||
        img.width < minSize || 
        img.height < minSize) {
        return false;
    }
    
    return true;
}

function isCarouselPostImage(img) {
    const src = img.src;
    const rect = img.getBoundingClientRect();
    
    // Must be a LinkedIn image
    if (!src.includes('licdn.com')) return false;
    
    // Must be visible and reasonably sized
    if (rect.width < 300 || rect.height < 200) return false;
    
    // Must not be profile/company images
    if (src.includes('profile-displayphoto') || 
        src.includes('company-logo') ||
        src.includes('person/') ||
        src.includes('company/')) return false;
        
    // Should be in the main content area
    const mainContent = img.closest('.feed-shared-update-v2, .share-update-card, [data-finite-scroll-hotkey-item]');
    return mainContent !== null;
}

function getHighResImageUrl(originalUrl) {
    // Try to get higher resolution version
    let url = originalUrl;
    
    // Remove size restrictions from LinkedIn URLs
    url = url.replace(/&w=\d+/, '');
    url = url.replace(/&h=\d+/, '');
    url = url.replace(/\/shrink_\d+_\d+\//, '/');
    
    // Add high quality parameters if not present
    if (url.includes('?') && !url.includes('q=')) {
        url += '&q=90'; // High quality
    }
    
    return url;
}

function extractPostContent() {
    const postContent = {
        text: '',
        hashtags: []
    };
    
    // Selectors for post text content
    const textSelectors = [
        '.feed-shared-update-v2__description',
        '.update-components-text',
        '.feed-shared-text',
        '.share-update-card__content',
        '[data-test-id="post-text"]'
    ];
    
    let textElement = null;
    for (const selector of textSelectors) {
        textElement = document.querySelector(selector);
        if (textElement) break;
    }
    
    if (textElement) {
        postContent.text = textElement.innerText.trim();
        
        // Extract hashtags
        const hashtagMatches = postContent.text.match(/#[\w\u0590-\u05ff]+/gi);
        if (hashtagMatches) {
            postContent.hashtags = hashtagMatches;
        }
    }
    
    return postContent;
}

function extractCreatorInfo() {
    const creatorInfo = {
        name: '',
        title: '',
        profileImage: '',
        profileUrl: ''
    };
    
    // Find creator information
    const creatorSelectors = [
        '.update-components-actor',
        '.feed-shared-actor',
        '.share-update-card__actor'
    ];
    
    let creatorElement = null;
    for (const selector of creatorSelectors) {
        creatorElement = document.querySelector(selector);
        if (creatorElement) break;
    }
    
    if (creatorElement) {
        // Extract name
        const nameElement = creatorElement.querySelector('.update-components-actor__name, .feed-shared-actor__name');
        if (nameElement) {
            creatorInfo.name = nameElement.innerText.trim();
            
            // Try to get profile URL from name link
            const nameLink = nameElement.querySelector('a') || nameElement.closest('a');
            if (nameLink) {
                creatorInfo.profileUrl = nameLink.href;
            }
        }
        
        // Extract title/description
        const titleElement = creatorElement.querySelector('.update-components-actor__description, .feed-shared-actor__description');
        if (titleElement) {
            creatorInfo.title = titleElement.innerText.trim();
        }
        
        // Extract profile image
        const profileImg = creatorElement.querySelector('img');
        if (profileImg && profileImg.src) {
            creatorInfo.profileImage = profileImg.src;
        }
    }
    
    return creatorInfo;
}

// Helper function to wait for elements to load
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }
        
        const observer = new MutationObserver((mutations) => {
            const element = document.querySelector(selector);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}