// Background script for image processing and downloads
console.log('LinkedIn Carousel Downloader: Background script loaded');

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'processCarousel') {
        processCarouselImages(request.data, request.options)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => {
                console.error('Error processing carousel:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep message channel open for async response
    }
});

async function processCarouselImages(data, options) {
    console.log('Processing carousel images...', data);
    
    const { images, postContent, creatorInfo, postUrl } = data;
    const { layout, dpi } = options;
    
    if (!images || images.length === 0) {
        throw new Error('No images to process');
    }
    
    // Load all images
    console.log('Loading images...');
    const loadedImages = await loadImages(images);
    
    // Create combined image
    console.log('Creating combined image...');
    const combinedImageBlob = await createCombinedImage(
        loadedImages, 
        postContent, 
        creatorInfo, 
        postUrl, 
        layout, 
        dpi
    );
    
    // Download the file
    console.log('Initiating download...');
    await downloadImage(combinedImageBlob, postContent.text);
    
    return { success: true };
}

async function loadImages(imageUrls) {
    const loadPromises = imageUrls.map(async (imageData) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                resolve({
                    image: img,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    alt: imageData.alt
                });
            };
            
            img.onerror = () => {
                console.warn(`Failed to load image: ${imageData.src}`);
                // Don't reject, just return null to filter out later
                resolve(null);
            };
            
            img.src = imageData.src;
        });
    });
    
    const results = await Promise.all(loadPromises);
    return results.filter(result => result !== null);
}

async function createCombinedImage(loadedImages, postContent, creatorInfo, postUrl, layout, dpi) {
    if (loadedImages.length === 0) {
        throw new Error('No images could be loaded');
    }
    
    // Calculate canvas dimensions based on layout and DPI
    const scale = dpi / 72; // Scale factor for DPI
    const padding = 40 * scale;
    const textHeight = 200 * scale; // Space for post content and creator info
    
    let canvasWidth, canvasHeight;
    let imagePositions = [];
    
    if (layout === 'grid') {
        // Grid layout - calculate optimal grid dimensions
        const cols = Math.ceil(Math.sqrt(loadedImages.length));
        const rows = Math.ceil(loadedImages.length / cols);
        
        // Find max dimensions for consistent sizing
        const maxWidth = Math.max(...loadedImages.map(img => img.width));
        const maxHeight = Math.max(...loadedImages.map(img => img.height));
        
        const imageWidth = (maxWidth * scale) * 0.8; // Scale down slightly
        const imageHeight = (maxHeight * scale) * 0.8;
        
        canvasWidth = (cols * imageWidth) + ((cols + 1) * padding);
        canvasHeight = (rows * imageHeight) + ((rows + 1) * padding) + textHeight;
        
        // Calculate positions
        for (let i = 0; i < loadedImages.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            imagePositions.push({
                x: padding + (col * (imageWidth + padding)),
                y: padding + (row * (imageHeight + padding)),
                width: imageWidth,
                height: imageHeight
            });
        }
    } else {
        // Vertical layout
        const maxWidth = Math.max(...loadedImages.map(img => img.width));
        const imageWidth = maxWidth * scale;
        const totalImageHeight = loadedImages.reduce((sum, img) => {
            const aspectRatio = img.height / img.width;
            return sum + (imageWidth * aspectRatio) + padding;
        }, 0);
        
        canvasWidth = imageWidth + (2 * padding);
        canvasHeight = totalImageHeight + textHeight + padding;
        
        // Calculate positions
        let currentY = padding;
        for (let i = 0; i < loadedImages.length; i++) {
            const img = loadedImages[i];
            const aspectRatio = img.height / img.width;
            const imageHeight = imageWidth * aspectRatio;
            
            imagePositions.push({
                x: padding,
                y: currentY,
                width: imageWidth,
                height: imageHeight
            });
            
            currentY += imageHeight + padding;
        }
    }
    
    // Create canvas
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw images
    for (let i = 0; i < loadedImages.length; i++) {
        const img = loadedImages[i];
        const pos = imagePositions[i];
        
        // Draw image with preserved aspect ratio
        drawImageWithAspectRatio(ctx, img.image, pos.x, pos.y, pos.width, pos.height);
        
        // Add image border
        ctx.strokeStyle = '#e1e5e9';
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);
    }
    
    // Add text content at the bottom
    const textY = canvasHeight - textHeight + (20 * scale);
    await drawTextContent(ctx, postContent, creatorInfo, postUrl, padding, textY, canvasWidth - (2 * padding), scale);
    
    // Convert to blob
    return await canvas.convertToBlob({ type: 'image/png', quality: 1.0 });
}

function drawImageWithAspectRatio(ctx, img, x, y, maxWidth, maxHeight) {
    const imgAspectRatio = img.width / img.height;
    const boxAspectRatio = maxWidth / maxHeight;
    
    let drawWidth, drawHeight, drawX, drawY;
    
    if (imgAspectRatio > boxAspectRatio) {
        // Image is wider than box
        drawWidth = maxWidth;
        drawHeight = maxWidth / imgAspectRatio;
        drawX = x;
        drawY = y + (maxHeight - drawHeight) / 2;
    } else {
        // Image is taller than box
        drawHeight = maxHeight;
        drawWidth = maxHeight * imgAspectRatio;
        drawX = x + (maxWidth - drawWidth) / 2;
        drawY = y;
    }
    
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

async function drawTextContent(ctx, postContent, creatorInfo, postUrl, x, y, maxWidth, scale) {
    ctx.fillStyle = '#333333';
    
    // Post text
    if (postContent.text) {
        ctx.font = `${16 * scale}px Arial, sans-serif`;
        const wrappedText = wrapText(ctx, postContent.text, maxWidth - (20 * scale));
        let textY = y + (20 * scale);
        
        wrappedText.forEach(line => {
            ctx.fillText(line, x + (10 * scale), textY);
            textY += (20 * scale);
        });
        
        y = textY + (10 * scale);
    }
    
    // Hashtags
    if (postContent.hashtags && postContent.hashtags.length > 0) {
        ctx.fillStyle = '#0077b5';
        ctx.font = `${14 * scale}px Arial, sans-serif`;
        const hashtagText = postContent.hashtags.join(' ');
        ctx.fillText(hashtagText, x + (10 * scale), y);
        y += (25 * scale);
    }
    
    // Creator info
    ctx.fillStyle = '#666666';
    ctx.font = `${12 * scale}px Arial, sans-serif`;
    
    if (creatorInfo.name) {
        ctx.fillText(`By: ${creatorInfo.name}`, x + (10 * scale), y);
        y += (15 * scale);
    }
    
    if (creatorInfo.title) {
        ctx.fillText(creatorInfo.title, x + (10 * scale), y);
        y += (15 * scale);
    }
    
    // Original post URL
    ctx.fillStyle = '#0077b5';
    ctx.font = `${10 * scale}px Arial, sans-serif`;
    ctx.fillText(`Original post: ${postUrl}`, x + (10 * scale), y);
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine !== '') {
            lines.push(currentLine.trim());
            currentLine = words[i] + ' ';
        } else {
            currentLine = testLine;
        }
    }
    
    if (currentLine.trim() !== '') {
        lines.push(currentLine.trim());
    }
    
    return lines;
}

async function downloadImage(blob, postText) {
    // Generate filename from post text or use default
    let filename = 'linkedin-carousel';
    
    if (postText) {
        // Create filename from first few words of post
        const words = postText.split(' ').slice(0, 5);
        filename = words.join('-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
        if (filename.length < 3) {
            filename = 'linkedin-carousel';
        }
    }
    
    filename += `-${Date.now()}.png`;
    
    // Create object URL for the blob
    const url = URL.createObjectURL(blob);
    
    try {
        // Use Chrome downloads API
        await chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true
        });
        
        console.log('Download initiated successfully');
    } catch (error) {
        console.error('Download failed:', error);
        throw new Error('Failed to download image');
    } finally {
        // Clean up the object URL
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }
}