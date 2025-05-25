// Content script for LinkedIn carousel extraction
console.log('LinkedIn Carousel Downloader: Content script loaded');

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
    console.log('🔍 SUPER SIMPLE DEBUG MODE');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const allImages = document.querySelectorAll('img');
    console.log(`Found ${allImages.length} total images on page`);
    
    const validImages = [];
    
    // Super permissive - accept ANY LinkedIn image
    allImages.forEach((img, i) => {
        if (i < 10) { // Only log first 10 for readability
            console.log(`Image ${i}:`);
            console.log(`  URL: ${img.src}`);
            console.log(`  Size: ${img.width}x${img.height}`);
            console.log(`  Natural: ${img.naturalWidth}x${img.naturalHeight}`);
        }
        
        if (img.src.includes('licdn.com') && 
            !img.src.includes('profile-displayphoto') &&
            (img.width > 50 || img.naturalWidth > 50)) {
            
            validImages.push({
                src: img.src,
                alt: img.alt || '',
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height
            });
            
            console.log(`✅ Accepted image ${i}: ${img.src.substring(0, 50)}...`);
        }
    });
    
    console.log(`Final count: ${validImages.length} images`);
    
    if (validImages.length === 0) {
        throw new Error(`No valid images found. Total images on page: ${allImages.length}`);
    }
    
    return {
        images: validImages,
        postContent: { text: 'Test post content', hashtags: ['#test'] },
        creatorInfo: { name: 'Test User', title: 'Test Title', profileImage: '', profileUrl: '' },
        postUrl: window.location.href
    };
}
