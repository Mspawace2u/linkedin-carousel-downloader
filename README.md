# LinkedIn Carousel Downloader

A Chrome extension that downloads all images from LinkedIn carousel posts as a single combined image with post content and creator information.

## Features

- 📱 Download all carousel images from LinkedIn posts
- 🖼️ Combine images in grid or vertical layout
- 📝 Include post text, hashtags, and links
- 👤 Add creator profile information
- ⚙️ Adjustable DPI quality (72, 150, 300)
- 🔒 Works with your existing LinkedIn login
- 🚀 Fast and secure image processing

## Installation

1. Download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select this folder
5. Pin the extension to your toolbar

## Usage

1. Log into LinkedIn and find a carousel post
2. Copy the post URL
3. Click the extension icon
4. Paste the URL and choose your settings
5. Click "Download Carousel"

## Files

- `manifest.json` - Extension configuration
- `popup.html/css/js` - User interface
- `content-script.js` - LinkedIn data extraction
- `background.js` - Image processing
- `icons/` - Extension icons

Made with ❤️ for easier LinkedIn content management