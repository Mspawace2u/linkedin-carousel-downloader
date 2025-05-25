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
        return true;
    }
});

async function extractCarouselData(options) {
    console.log('=== Starting LinkedIn Carousel Extraction ===');
    console.log('URL:', window.location.href);
    
    await waitForPageLoad();
    
    const carouselData = await findCarouselImages();
    
    if (!carouselData.images || carouselData.images.length === 0) {
        throw new Error('No carousel images found. Please make sure this is a LinkedIn carousel post with multiple images.');
    }
    
    const postContent = extractPostContent();
    const creatorInfo = extractCreatorInfo();
    
    console.log(`✅ Success: Found ${carouselData.images.length} carousel images`);
    
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
            setTimeout(resolve, 3000);
        } else {
            window.addEventListener('load', () => {
                setTimeout(resolve, 3000);
            });
        }
    });
}

async function findCarouselImages() {
    console.log('🔍 Starting image detection...');
    
    const allImages = document.querySelectorAll('img');
    console.log(`Total images on page: ${allImages.length}`);
    
    const validImages = [];
    
    // Simple approach: find any LinkedIn images that are large enough
    allImages.forEach((img, index) => {
        const src = img.src;
        const width = Math.max(img.width || 0, img.naturalWidth || 0);
        const height = Math.max(img.height || 0, img.naturalHeight || 0);
        
        console.log(`Image ${index}: ${src.substring(0, 60)}... (${width}x${height})`);
        
        // Very permissive criteria
        if (src.includes('licdn.com') && 
            !src.includes('profile-displayphoto') && 
            !src.includes('company-logo') &&
            width > 100 && 
            height > 100) {
            
            console.log(`✅ Added image ${index}: ${width}x${height}`);
            
            validImages.push({
                src: src,
                alt: img.alt || '',
                width: width,
                height: height
            });
        } else {
            console.log(`❌ Rejected image ${index}: LinkedIn=${src.includes('licdn.com')}, Size=${width}x${height}`);
        }
    });
    
    console.log(`Final result: ${validImages.length} valid images found`);
    return { images: validImages };
}

function extractPostContent() {
    // Simple text extraction
    const textElements = document.querySelectorAll('[dir="ltr"], .break-words, .attributed-text-segment-list__content');
    let postText = '';
    
    for (const element of textElements) {
        const text = element.innerText?.trim();
        if (text && text.length > 20) {
            postText = text;
            console.log(`Found post text: ${text.substring(0, 100)}...`);
            break;
        }
    }
    
    const hashtags = postText.match(/#[\w]+/g) || [];
    
    return {
        text: postText,
        hashtags: hashtags
    };
}

function extractCreatorInfo() {
    // Simple creator extraction
    const nameElements = document.querySelectorAll('a[href*="/in/"]');
    let creatorName = '';
    let profileUrl = '';
    
    for (const element of nameElements) {
        const text = element.innerText?.trim();
        if (text && text.length > 2 && text.length < 100) {
            creatorName = text;
            profileUrl = element.href;
            console.log(`Found creator: ${creatorName}`);
            break;
        }
    }
    
    return {
        name: creatorName,
        title: '',
        profileImage: '',
        profileUrl: profileUrl
    };
}
