console.log("🌐 Background script started");

// Configuration
const CHECK_API_URL = "https://pixelgen.onrender.com/check";

// Tracked pixels storage
const trackedPixels = new Map();

// 1. Listen for new pixel registrations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "registerPixel") {
    const { pixelId, subject, recipient } = message;
    
    trackedPixels.set(pixelId, {
      tabId: sender.tab.id,
      subject,
      recipient,
      notified: false
    });
    
    console.log(`📬 Registered pixel: ${pixelId} (${subject} to ${recipient})`);
    sendResponse({ status: "registered" });
  }
  return true; // Keep message channel open
});

// Cleanup closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [pixelId, data] of trackedPixels) {
    if (data.tabId === tabId) {
      trackedPixels.delete(pixelId);
      console.log(`🗑️ Removed pixel ${pixelId} (tab closed)`);
    }
  }
});

// 2. Periodically check pixel status
async function checkPixelStatus() {
  console.log("🔄 Checking pixel statuses...");
  for (const [pixelId, data] of trackedPixels) {
    if (data.notified) {
      console.log(`⏩ Pixel ${pixelId} already notified, skipping`);
      continue;
    }
    
    try {
      console.log(`🌐 Checking pixel: ${pixelId}`);
      const response = await fetch(`${CHECK_API_URL}?id=${pixelId}`);
      const result = await response.json();
      console.log(`📊 Pixel ${pixelId} status: ${result.ips?.length || 0} IPs`);
      
      if (result.ips && result.ips.length >= 2) {
        console.log(`✨ Triggering notification for pixel: ${pixelId}`);
        chrome.tabs.sendMessage(data.tabId, {
          action: "showTick",
          pixelId: pixelId
        });
        
        trackedPixels.get(pixelId).notified = true;
      }
    } catch (error) {
      console.error(`⚠️ Pixel check failed: ${pixelId}`, error);
    }
  }
}

// Check every 30 seconds
setInterval(checkPixelStatus, 30000);
console.log("⏱️ Status checker started (30s interval)");

// Initial check after startup
setTimeout(checkPixelStatus, 5000);
