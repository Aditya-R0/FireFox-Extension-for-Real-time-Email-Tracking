console.log("🚀 Email Tracker content script loaded");

// Configuration
const SERVER_URL = "https://pixelgen.onrender.com/create";

// Track injected compose boxes to prevent duplicates
const trackedBoxes = new WeakSet();

// Debugging state
console.log("🔍 Initializing MutationObserver...");

// Main processing function
function processComposeBoxes() {
  const composeBoxes = document.querySelectorAll('[aria-label="Message Body"][contenteditable="true"]');
  console.log(`📝 Compose boxes found: ${composeBoxes.length}`);

  composeBoxes.forEach(box => {
    if (trackedBoxes.has(box)) {
      console.log("⏩ Already tracked compose box, skipping");
      return;
    }
    
    trackedBoxes.add(box);
    console.log("🟠 New compose box detected");
    
    // Store injection status
    box.dataset.trackerEnabled = "true";
    
    // Inject on first input OR after 5 seconds
    const injectOnce = async () => {
      if (box.querySelector('img[data-tracker]')) {
        console.log("⏩ Pixel already exists, skipping injection");
        return;
      }
      
      try {
        // Re-query subject/recipient at injection time
        const subject = document.querySelector('[name="subjectbox"]')?.value || "No Subject";
        const recipient = document.querySelector('[name="to"]')?.textContent || "Unknown";
        console.log(`✉️ Preparing pixel for: "${subject}" to ${recipient}`);
        
        const pixel = document.createElement('img');
        pixel.src = await getPixelUrl(subject, recipient);
        pixel.style.display = 'none';
        pixel.alt = '';
        pixel.setAttribute('data-tracker', 'true');
        box.appendChild(pixel);

        // Extract pixel ID
        const pixelId = pixel.src.split('/').pop().split('.')[0];
        console.log(`🟢 Pixel injected: ${pixelId}`);

        // Register with background
        chrome.runtime.sendMessage({
          action: "registerPixel",
          pixelId: pixelId,
          subject: subject,
          recipient: recipient
        });
      } catch (error) {
        console.error("❌ Pixel injection failed:", error);
      }
      
      // Cleanup listeners
      box.removeEventListener('input', injectOnce);
      clearTimeout(timeoutId);
    };

    // 1. Inject on first user input
    box.addEventListener('input', injectOnce, { once: true });
    console.log("👂 Listening for first input...");
    
    // 2. Backup: Inject after 5 seconds
    const timeoutId = setTimeout(() => {
      console.log("⏱️ 5s timeout reached, injecting pixel");
      injectOnce();
    }, 5000);
  });
}

// Create observer with delay for Gmail's dynamic UI
setTimeout(() => {
  const observer = new MutationObserver(processComposeBoxes);
  observer.observe(document.body, { childList: true, subtree: true });
  console.log("🔍 Observer started with 1s delay");
  
  // Initial check
  processComposeBoxes();
}, 1000);

// Get pixel URL from server
async function getPixelUrl(subject, recipient) {
  console.log("🌐 Requesting pixel URL from server...");
  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, recipient })
    });
    const data = await response.json();
    console.log("🔗 Server response:", data.url);
    return data.url;
  } catch (error) {
    console.error("❌ Pixel URL fetch failed:", error);
    return "https://pixelgen.onrender.com/tracker/fallback.png";
  }
}

// Find sent email in Gmail's UI
function findSentEmail(pixelId) {
  console.log(`🔍 Searching for sent email with pixel: ${pixelId}`);
  try {
    // Gmail's sent item row structure
    const emailRows = document.querySelectorAll('tr[data-message-id]');
    console.log(`📩 Found ${emailRows.length} email rows`);
    
    for (const row of emailRows) {
      // Extract subject and recipient from row
      const subjectElement = row.querySelector('.bog span');
      const recipientElement = row.querySelector('.yP');
      
      if (subjectElement && recipientElement) {
        const subject = subjectElement.textContent.trim();
        const recipient = recipientElement.textContent.trim();
        
        // Check if matches tracked pixel
        if (subject && recipient) {
          console.log(`ℹ️ Checking: "${subject}" to ${recipient}`);
          // This should match your storage logic
          if (`${subject}-${recipient}` === pixelId) {
            console.log("✅ Matching sent email found");
            return row;
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Error finding sent email:", error);
  }
  return null;
}

// Listen for tick notifications
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "showTick") {
    console.log(`✅ Received showTick for pixel: ${request.pixelId}`);
    const emailElement = findSentEmail(request.pixelId);
    
    if (emailElement) {
      // Check if tick already exists
      if (!emailElement.querySelector('.email-tracker-tick')) {
        const tick = document.createElement('span');
        tick.className = 'email-tracker-tick';
        tick.innerHTML = '✅';
        tick.style.marginLeft = '8px';
        emailElement.appendChild(tick);
        console.log("🟢 Tick added to sent email");
      } else {
        console.log("⏩ Tick already exists");
      }
    } else {
      console.log("❌ Couldn't find sent email for pixel");
    }
  }
});
