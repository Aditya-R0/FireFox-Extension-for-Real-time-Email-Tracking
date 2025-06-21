// Background script for email tracking extension

// Configuration
const CHECK_API_URL = "https://pixelgen.onrender.com/check";

// Tracked pixels storage: { pixelId: { tabId, subject, recipient, notified } }
const trackedPixels = new Map();

// 1. Listen for new pixel injections from content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "registerPixel") {
    const { pixelId, subject, recipient } = message;
    
    // Store pixel metadata with tab ID
    trackedPixels.set(pixelId, {
      tabId: sender.tab.id,
      subject,
      recipient,
      notified: false // Track notification status
    });
    
    console.log(`📬 Registered new pixel: ${pixelId}`);
    sendResponse({ status: "registered" });
  }
});

// 2. Periodically check pixel status
async function checkPixelStatus() {
  for (const [pixelId, data] of trackedPixels) {
    if (data.notified) continue; // Skip already notified pixels
    
    try {
      const response = await fetch(`${CHECK_API_URL}?id=${pixelId}`);
      const result = await response.json();
      
      // 3. Check if email was opened (≥2 unique IPs)
      if (result.ips && result.ips.length >= 2) {
        // 4. Notify content.js to show tick
        chrome.tabs.sendMessage(data.tabId, {
          action: "showTick",
          pixelId: pixelId
        });
        
        // Mark as notified
        trackedPixels.get(pixelId).notified = true;
        console.log(`✅ Notified tab ${data.tabId} for pixel ${pixelId}`);
      }
    } catch (error) {
      console.error(`⚠️ Pixel check failed: ${pixelId}`, error);
    }
  }
}

// Check every 30 seconds
setInterval(checkPixelStatus, 30000);
