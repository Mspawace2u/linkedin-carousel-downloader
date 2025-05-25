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
            setTimeout(resolve, 2000); // Additional wait for dynamic content
        } else {
            window.addEventListener('load', () => {
                setTimeout(resolve, 2000);
            });
        }
    });
}

async function findCarouselImages() {
    const images = [];
    
    console.log('=== DEBUGGING CAROUSEL DETECTION ===');
    console.log('Current URL:', window.location.href);
    
    // First, let's see what images exist on the page
    const allImages = document.querySelectorAll('img');
    console.log(`Total images found on page: ${allImages.length}`);
    
    // Log first few image sources for debugging
    allImages.forEach((img, index) => {
        if (index < 15) { // Show more images for debugging
            console.log(`Image ${index}:`);
            console.log(`  - Src: ${img.src.substring(0, 100)}...`);
            console.log(`  - Size: ${img.width}x${img.height} (natural: ${img.naturalWidth}x${img.naturalHeight})`);
            console.log(`  - Classes: ${img.className}`);
            console.log(`  - Alt: ${img.alt}`);
            console.log('---');
        }
    });
    
    // Try multiple detection strategies
    const strategies = [
        // Strategy 1: Look for modern LinkedIn image patterns
        () => {
            const imgs = document.querySelectorAll('img[src*="licdn.com"]:not([src*="profile"]):not([src*="company-logo"])');
            console.log(`Strategy 1 - LinkedIn CDN images (filtered): ${imgs.length}`);
            return Array.from(imgs);
        },
        
        // Strategy 2: Look for images in main content areas
        () => {
            const selectors = [
                'article img',
                '[data-id] img', 
                '.feed-shared-update-v2 img',
                '.update-components-image img',
                '.feed-shared-image img',
                'main img',
                '[role="main"] img'
            ];
            
            let allImgs = [];
            for (const selector of selectors) {
                const imgs = document.querySelectorAll(selector);
                console.log(`  ${selector}: ${imgs.length} images`);
                allImgs = allImgs.concat(Array.from(imgs));
            }
            
            console.log(`Strategy 2 - Content area images: ${allImgs.length}`);
            return allImgs;
        },
        
        // Strategy 3: Look for large images (likely content images)
        () => {
            const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
                const rect = img.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0;
                const isLargeEnough = rect.width > 200 && rect.height > 100;
                const hasLinkedInSrc = img.src.includes('licdn.com');
                
                if (isVisible && isLargeEnough && hasLinkedInSrc) {
                    console.log(`Large image candidate: ${img.src.substring(0, 50)}... (${rect.width}x${rect.height})`);
                }
                
                return isVisible && isLargeEnough && hasLinkedInSrc;
            });
            console.log(`Strategy 3 - Large visible LinkedIn images: ${imgs.length}`);
            return imgs;
        },
        
        // Strategy 4: Aggressive search - any reasonable LinkedIn image
        () => {
            const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
                return img.src.includes('licdn.com') && 
                       !img.src.includes('profile-displayphoto') &&
                       !img.src.includes('company-logo') &&
                       !img.src.includes('icon') &&
                       (img.width > 150 || img.naturalWidth > 150);
            });
            console.log(`Strategy 4 - Aggressive LinkedIn image search: ${imgs.length}`);
            return imgs;
        }
    ];
    
    // Try each strategy
    for (let i = 0; i < strategies.length; i++) {
        console.log(`\nTrying Strategy ${i + 1}:`);
        const foundImages = strategies[i]();
        
        for (const img of foundImages) {
            console.log(`Checking image: ${img.src.substring(0, 50)}...`);
            if (isValidCarouselImage(img)) {
                const imageData = {
                    src: getHighResImageUrl(img.src),
                    alt: img.alt || '',
                    width: img.naturalWidth || img.width,
                    height: img.naturalHeight || img.height
                };
                images.push(imageData);
                console.log(`✅ Added valid image: ${imageData.src.substring(0, 50)}...`);
            } else {
                console.log(`❌ Image rejected by validation`);
            }
        }
        
        if (images.length > 0) {
            console.log(`✅ Strategy ${i + 1} found ${images.length} images - stopping search`);
            break;
        }
    }
    
    console.log(`\nFinal result: ${images.length} valid carousel images found`);
    console.log('=== END DEBUGGING ===');
    
    return { images };
}

function isValidCarouselImage(img) {
    const src = img.src;
    const rect = img.getBoundingClientRect();
    
    // Check if it's a LinkedIn media image
    if (!src.includes('licdn.com')) {
        console.log(`  Rejected: Not a LinkedIn CDN image`);
        return false;
    }
    
    // Filter out profile pictures, icons, and small images
    if (src.includes('profile-displayphoto') || 
        src.includes('company-logo') || 
        src.includes('person/') ||
        src.includes('company/') ||
        src.includes('icon')) {
        console.log(`  Rejected: Profile/company/icon image`);
        return false;
    }
    
    // Check minimum size (either current display size or natural size)
    const width = Math.max(img.width, img.naturalWidth || 0);
    const height = Math.max(img.height, img.naturalHeight || 0);
    
    if (width < 150 || height < 100) {
        console.log(`  Rejected: Too small (${width}x${height})`);
        return false;
    }
    
    console.log(`  ✅ Valid image (${width}x${height})`);
    return true;
}

function isCarouselPostImage(img) {
    const src = img.src;
    const rect = img.getBoundingClientRect();
    
    // Must be a LinkedIn image
    if (!src.includes('licdn.com')) return false;
    
    // Must be visible and reasonably sized
    if (rect.width < 200 || rect.height < 150) return false;
    
    // Must not be profile/company images
    if (src.includes('profile-displayphoto') || 
        src.includes('company-logo') ||
        src.includes('person/') ||
        src.includes('company/')) return false;
        
    // Should be in the main content area
    const mainContent = img.closest('article, .feed-shared-update-v2, .share-update-card, [data-id], main, [role="main"]');
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
    } else if (!url.includes('?')) {
        url += '?q=90';
    }
    
    return url;
}

function extractPostContent() {
    const postContent = {
        text: '',
        hashtags: []
    };
    
    // Expanded selectors for post text content
    const textSelectors = [
        '.feed-shared-update-v2__description',
        '.update-components-text',
        '.feed-shared-text',
        '.share-update-card__content',
        '[data-test-id="post-text"]',
        'article .break-words',
        '.feed-shared-update-v2 .break-words',
        '[dir="ltr"]',
        '.attributed-text-segment-list__content'
    ];
    
    let textElement = null;
    for (const selector of textSelectors) {
        textElement = document.querySelector(selector);
        if (textElement && textElement.innerText.trim()) {
            console.log(`Found post text with selector: ${selector}`);
            break;
        }
    }
    
    if (textElement) {
        postContent.text = textElement.innerText.trim();
        
        // Extract hashtags
        const hashtagMatches = postContent.text.match(/#[\w\u0590-\u05ff]+/gi);
        if (hashtagMatches) {
            postContent.hashtags = hashtagMatches;
        }
        
        console.log(`Extracted post text: ${postContent.text.substring(0, 100)}...`);
    } else {
        console.log('No post text found');
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
    
    // Expanded selectors for creator information
    const creatorSelectors = [
        '.update-components-actor',
        '.feed-shared-actor',
        '.share-update-card__actor',
        'article .update-components-actor',
        '.feed-shared-update-v2 .update-components-actor'
    ];
    
    let creatorElement = null;
    for (const selector of creatorSelectors) {
        creatorElement = document.querySelector(selector);
        if (creatorElement) {
            console.log(`Found creator element with selector: ${selector}`);
            break;
        }
    }
    
    if (creatorElement) {
        // Extract name with expanded selectors
        const nameSelectors = [
            '.update-components-actor__name',
            '.feed-shared-actor__name',
            'a[href*="/in/"]',
            '.update-components-actor__container a'
        ];
        
        let nameElement = null;
        for (const selector of nameSelectors) {
            nameElement = creatorElement.querySelector(selector);
            if (nameElement && nameElement.innerText.trim()) break;
        }
        
        if (nameElement) {
            creatorInfo.name = nameElement.innerText.trim();
            
            // Try to get profile URL from name link
            const nameLink = nameElement.querySelector('a') || nameElement.closest('a');
            if (nameLink && nameLink.href) {
                creatorInfo.profileUrl = nameLink.href;
            }
        }
        
        // Extract title/description with expanded selectors
        const titleSelectors = [
            '.update-components-actor__description',
            '.feed-shared-actor__description',
            '.update-components-actor__meta-description'
        ];
        
        let titleElement = null;
        for (const selector of titleSelectors) {
            titleElement = creatorElement.querySelector(selector);
            if (titleElement && titleElement.innerText.trim()) break;
        }
        
        if (titleElement) {
            creatorInfo.title = titleElement.innerText.trim();
        }
        
        // Extract profile image
        const profileImg = creatorElement.querySelector('img');
        if (profileImg && profileImg.src) {
            creatorInfo.profileImage = profileImg.src;
        }
        
        console.log(`Extracted creator: ${creatorInfo.name} - ${creatorInfo.title}`);
    } else {
        console.log('No creator information found');
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
