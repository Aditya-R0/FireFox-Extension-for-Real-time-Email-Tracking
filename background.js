// Background script with enhanced debugging - FIXED VERSION
let lastPoll = new Date().toISOString();
let pollingStarted = false;
let retryCount = 0;

console.log('[DEBUG] Background script initialized');

// Initialize storage
browser.storage.local.get(['trackedEmails', 'processedPixels'])
  .then(data => {
    console.log('[DEBUG] Storage initialized:', data);
    if (!data.trackedEmails) {
      console.log('[DEBUG] Initializing trackedEmails');
      browser.storage.local.set({ trackedEmails: {} });
    }
    if (!data.processedPixels) {
      console.log('[DEBUG] Initializing processedPixels');
      browser.storage.local.set({ processedPixels: [] });
    }
  });

// Configuration
const POLLING_INTERVAL = 30000;
const BASE_CHECK_URL = "https://pixelgen.onrender.com/check";

function checkForOpenedEmails() {
  console.log('[DEBUG] Starting email check');
  browser.storage.local.get(['trackedEmails']).then(data => {
    const trackedEmails = data.trackedEmails || {};
    const pixelIds = Object.keys(trackedEmails);
    console.log(`[DEBUG] Tracking ${pixelIds.length} pixels:`, pixelIds);
    
    if (pixelIds.length === 0) {
      console.log('[DEBUG] No pixels to check');
      return;
    }
    
    // Call the /check endpoint (no ID parameter needed)
    fetch(`${BASE_CHECK_URL}`)
      .then(response => {
        console.log(`[DEBUG] Fetching all pixel data from server`);
        if (!response.ok) {
          console.error(`[ERROR] HTTP ${response.status}`);
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log(`[DEBUG] Server response:`, data);
        if (data.openedPixels && Array.isArray(data.openedPixels)) {
          processOpenedPixels(data.openedPixels, pixelIds, trackedEmails);
        } else {
          console.log('[DEBUG] No openedPixels in response or invalid format');
        }
      })
      .catch(error => {
        console.error('[ERROR] Polling failed:', error);
        const delay = POLLING_INTERVAL * Math.pow(2, retryCount++);
        setTimeout(checkForOpenedEmails, Math.min(delay, 300000));
      });
  });
}

function processOpenedPixels(openedPixels, trackedPixelIds, trackedEmails) {
  console.log(`[DEBUG] Processing ${openedPixels.length} opened pixels`);
  console.log('[DEBUG] Tracked pixel IDs:', trackedPixelIds);
  
  browser.storage.local.get(['processedPixels']).then(data => {
    let processedPixels = data.processedPixels || [];
    const processedSet = new Set(processedPixels);
    let updated = false;

    openedPixels.forEach(pixelData => {
      const pixelId = pixelData.id;
      const ips = pixelData.ips || [];
      
      console.log(`[DEBUG] Checking pixel ${pixelId} with ${ips.length} IPs:`, ips);
      
      // Only process pixels we're tracking
      if (!trackedPixelIds.includes(pixelId)) {
        console.log(`[DEBUG] ${pixelId} not in our tracked list, skipping`);
        return;
      }
      
      // Skip if already processed
      if (processedSet.has(pixelId)) {
        console.log(`[DEBUG] ${pixelId} already processed`);
        return;
      }
      
      const ipCount = ips.length;
      console.log(`[DEBUG] ${pixelId} has ${ipCount} unique IPs, need >= 2`);
      
      if (ipCount >= 2) {
        if (trackedEmails[pixelId] && !trackedEmails[pixelId].opened) {
          console.log(`[DEBUG] ✅ Marking ${pixelId} as opened`);
          trackedEmails[pixelId].opened = true;
          trackedEmails[pixelId].openedAt = new Date().toISOString();
          processedPixels.push(pixelId);
          processedSet.add(pixelId);
          updated = true;
          showNotification(trackedEmails[pixelId]);
        } else {
          console.log(`[DEBUG] ${pixelId} already opened or missing from tracked emails`);
        }
      } else {
        console.log(`[DEBUG] ${pixelId} needs more IPs (current: ${ipCount}, need: 2)`);
      }
    });

    if (updated) {
      console.log('[DEBUG] Updating storage with new data');
      browser.storage.local.set({ trackedEmails, processedPixels })
        .then(() => {
          console.log('[DEBUG] Storage updated, notifying content scripts');
          notifyContentScripts();
        })
        .catch(error => console.error('[ERROR] Storage update failed:', error));
    } else {
      console.log('[DEBUG] No updates to apply');
    }
  });
}

function showNotification(email) {
  console.log('[DEBUG] Showing notification for:', email);
  browser.notifications.create({
    type: "basic",
    iconUrl: "icons/icon-48.png",
    title: "Email Opened",
    message: `${email.recipient} opened: "${email.subject}"`
  }).catch(console.error);
}

function notifyContentScripts() {
  console.log('[DEBUG] Notifying content scripts');
  browser.tabs.query({ url: "*://mail.google.com/*" })
    .then(tabs => {
      console.log(`[DEBUG] Found ${tabs.length} Gmail tabs`);
      tabs.forEach(tab => {
        console.log(`[DEBUG] Sending update to tab ${tab.id}`);
        browser.tabs.sendMessage(tab.id, { action: "update_read_status" })
          .then(() => console.log(`[DEBUG] Successfully notified tab ${tab.id}`))
          .catch(error => console.error(`[ERROR] Tab ${tab.id} update failed:`, error));
      });
    })
    .catch(console.error);
}

// Message handling
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[DEBUG] Received message:', message);
  
  if (message.action === "register_email") {
    browser.storage.local.get('trackedEmails').then(data => {
      const trackedEmails = data.trackedEmails || {};
      trackedEmails[message.pixelId] = {
        subject: message.subject,
        recipient: message.recipient,
        sentAt: Date.now(),
        opened: false,
        threadId: message.threadId
      };
      console.log(`[DEBUG] Registered new email: ${message.pixelId}`, trackedEmails[message.pixelId]);
      return browser.storage.local.set({ trackedEmails });
    }).then(() => {
      if (!pollingStarted) {
        pollingStarted = true;
        console.log('[DEBUG] Starting polling service');
        setInterval(checkForOpenedEmails, POLLING_INTERVAL);
        checkForOpenedEmails();
      }
      sendResponse({ success: true });
    }).catch(err => {
      console.error("[ERROR] Registration failed:", err);
      sendResponse({ success: false });
    });
    return true;
  }
  
  if (message.action === "get_tracked_emails") {
    browser.storage.local.get('trackedEmails')
      .then(data => {
        console.log('[DEBUG] Sending tracked emails to content script:', data.trackedEmails);
        sendResponse({ trackedEmails: data.trackedEmails || {} });
      })
      .catch(() => sendResponse({ trackedEmails: {} }));
    return true;
  }
});

// Weekly cleanup
setInterval(() => {
  console.log('[DEBUG] Running storage cleanup');
  browser.storage.local.get('processedPixels').then(data => {
    const processedPixels = data.processedPixels || [];
    browser.storage.local.set({ 
      processedPixels: processedPixels.slice(-1000)
    });
  });
}, 604800000);

// Notification handler
browser.notifications.onClicked.addListener(() => {
  browser.tabs.create({url: "https://mail.google.com"});
});

// Initial execution
console.log('[DEBUG] Starting initial check');
checkForOpenedEmails();
