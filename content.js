console.log("🚀 Email Tracker content script loaded");

// Configuration
const SERVER_URL = "https://pixelgen.onrender.com/create";

// Track injected compose boxes to prevent duplicates
const trackedBoxes = new WeakSet();

// Observe for new compose boxes
const observer = new MutationObserver(() => {
  const composeBoxes = document.querySelectorAll('[aria-label="Message Body"][contenteditable="true"]');
  console.log("📝 Compose boxes found:", composeBoxes.length);

  composeBoxes.forEach(box => {
    if (trackedBoxes.has(box)) return;
    trackedBoxes.add(box);
    
    // No visual debug borders
    console.log("🟠 Compose box detected and marked.");
    
    // Store pixel injection status directly on box
    box.dataset.trackerEnabled = "true";
    
    // Inject on first input OR after 5 seconds (whichever comes first)
    const injectOnce = async () => {
      if (box.querySelector('img[data-tracker]')) return;
      
      const pixel = document.createElement('img');
      pixel.src = await getPixelUrl();
      pixel.style.display = 'none';
      pixel.alt = '';
      pixel.setAttribute('data-tracker', 'true');
      box.appendChild(pixel);

      // Extract pixelId from URL
      const pixelId = pixel.src.split('/').pop().split('.')[0];
      
      // ADD THESE LINES - Re-query subject and recipient
      const subject = document.querySelector('[name="subjectbox"]')?.value || "No Subject";
      const recipient = document.querySelector('[name="to"]')?.textContent || "Unknown";

      chrome.runtime.sendMessage({
        action: "registerPixel",
        pixelId: pixelId,
        subject: subject,
        recipient: recipient
      });
      
      console.log("🟢 Pixel injected:", pixel.src);
      
      // Cleanup after injection
      box.removeEventListener('input', injectOnce);
      clearTimeout(timeoutId);
    };


    // 1. Inject on first user input
    box.addEventListener('input', injectOnce, { once: true });
    
    // 2. Backup: Inject after 5 seconds if no input
    const timeoutId = setTimeout(injectOnce, 5000);
  });
});
observer.observe(document.body, { childList: true, subtree: true });

// Get pixel URL from server
async function getPixelUrl() {
  try {
    const subject = document.querySelector('[name="subjectbox"]')?.value || "No Subject";
    const recipient = document.querySelector('[name="to"]')?.textContent || "Unknown";
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, recipient })
    });
    const data = await response.json();
    console.log("🔗 Pixel URL received:", data.url);
    return data.url;
  } catch (error) {
    console.error("❌ Failed to get pixel URL:", error);
    return "https://pixelgen.onrender.com/tracker/fallback.png";
  }
}

// Helper to find sent email (implementation needed)
function findSentEmail(pixelId) {
  // DOM traversal logic to locate the sent email
  // Should match based on subject/recipient or data attribute
  return document.querySelector(`[data-pixel-id="${pixelId}"]`);
}

// Listen for tick notifications from background.js
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "showTick") {
    // Find sent email by pixel ID (implement this)
    const emailElement = findSentEmail(request.pixelId);
    
    if (emailElement) {
      // Add tick icon
      const tick = document.createElement('span');
      tick.innerHTML = '✅';
      tick.style.marginLeft = '8px';
      emailElement.appendChild(tick);
    }
  }
});

