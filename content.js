console.log("Email Tracker content script loaded");
function normalizeSubject(str) {
  return str
    .replace(/^(Re:|Fwd:|FW:)\s*/i, '') // Remove common prefixes
    .replace(/\s+/g, ' ')               // Collapse whitespace
    .trim()
    .toLowerCase();
}

// Configuration
const SERVER_URL = "https://pixelgen.onrender.com/create";
const trackedBoxes = new WeakSet();

// Observer for compose windows
const observer = new MutationObserver(() => {
  const composeBoxes = document.querySelectorAll('[aria-label="Message Body"][contenteditable="true"]');
  
  composeBoxes.forEach(box => {
    if (trackedBoxes.has(box)) return;
    trackedBoxes.add(box);
    
    // Inject on first input
    const injectOnce = async () => {
      if (box.dataset.trackerInjected) return;
      box.dataset.trackerInjected = "true";
      
      try {
        // Get subject with modern Gmail selector
        const subjectField = document.querySelector('input[aria-label="Subject"]') || 
                            document.querySelector('[name="subjectbox"]');
        const subject = subjectField?.value || "No Subject";
        
        // Get recipient with modern Gmail selector
        const recipientField = document.querySelector('[aria-label="To"]') || 
                             document.querySelector('[name="to"]');
        const recipient = recipientField?.textContent || recipientField?.innerText || "Unknown";
        
        // Extract thread ID from URL
        const threadIdMatch = window.location.href.match(/compose\/([a-zA-Z0-9]+)/);
        const threadId = threadIdMatch ? threadIdMatch[1] : "unknown";
        
        // Get pixel URL
        const response = await fetch(SERVER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, recipient })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const pixelUrl = data.url;
        
        // Extract pixel ID
        const pixelId = pixelUrl.split('/').pop().replace('.png', '');
        
        // Register with background script
        browser.runtime.sendMessage({
          action: "register_email",
          pixelId: pixelId,
          subject: subject,
          recipient: recipient,
          threadId: threadId
        });
        
        // Create and inject pixel
        const pixel = document.createElement('img');
        pixel.src = pixelUrl;
        pixel.style.display = 'none';
        pixel.alt = '';
        pixel.setAttribute('data-tracker', 'true');
        box.appendChild(pixel);
        
        console.log("🟢 Pixel injected:", pixelId);
      } catch (error) {
        console.error("❌ Pixel injection failed:", error);
      }
    };

    // Event listeners
    box.addEventListener('input', injectOnce, { once: true });
    
    // Watch for send button to ensure injection before send
    const sendObserver = new MutationObserver(() => {
      if (document.querySelector('[aria-label="Send"][data-tooltip="Send"]')) {
        injectOnce();
      }
    });
    sendObserver.observe(box, { childList: true, subtree: true });
  });
});

observer.observe(document.body, { childList: true, subtree: true });

// Read indicator functions
let updateTimeout;
function throttledUpdate() {
  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(updateReadIndicators, 1000);
}

// ENHANCED MESSAGE LISTENER WITH DEBUG
browser.runtime.onMessage.addListener((message) => {
  console.log('[CONTENT DEBUG] Received message:', message);
  if (message.action === "update_read_status") {
    console.log('[CONTENT DEBUG] Triggering read indicator update');
    throttledUpdate();
  }
});

// ENHANCED updateReadIndicators WITH EXTENSIVE DEBUG
async function updateReadIndicators() {
  console.log('[CONTENT DEBUG] Starting updateReadIndicators');
  
  try {
    const response = await browser.runtime.sendMessage({ action: "get_tracked_emails" });
    const trackedEmails = response.trackedEmails || {};
    
    console.log('[CONTENT DEBUG] Received tracked emails:', trackedEmails);
    console.log('[CONTENT DEBUG] Number of tracked emails:', Object.keys(trackedEmails).length);
    
    // Try different Gmail selectors
    const emailSelectors = [
      'tr[role="row"][data-legacy-thread-id]',
      'tr[jsaction*="click"]',
      '.zA',
      '[data-thread-id]',
      'tr.zA'
    ];
    
    let emailRows = [];
    for (const selector of emailSelectors) {
      emailRows = document.querySelectorAll(selector);
      console.log(`[CONTENT DEBUG] Selector "${selector}" found ${emailRows.length} rows`);
      if (emailRows.length > 0) break;
    }
    
    if (emailRows.length === 0) {
      console.log('[CONTENT DEBUG] No email rows found with any selector');
      return;
    }
    
    console.log('[CONTENT DEBUG] Processing', emailRows.length, 'email rows');
    
    emailRows.forEach((row, index) => {
      console.log(`[CONTENT DEBUG] Processing row ${index}:`, row);
      
      // Try different ways to get thread ID
      const threadId = row.dataset.legacyThreadId || 
                      row.dataset.threadId || 
                      row.getAttribute('data-legacy-thread-id') ||
                      row.getAttribute('data-thread-id');
      
      console.log(`[CONTENT DEBUG] Row ${index} threadId:`, threadId);
      
      // Try different subject selectors
       const subjectSelectors = [
        '.bog',                    // Most common Gmail subject selector
        '[data-tooltip*="subject"]',
        '.yW span',
        '.bqe .bog',
        '.yW .bog',               // Another common pattern
        '.yW .bqg',               // Gmail uses this sometimes
        'span[title*="subject"]',  // Fallback
        '.zA .bog',               // Sent folder pattern
        'span[email]'             // Keep as last resort (this was wrong)
      ];
            
      let subjectElement = null;
      for (const selector of subjectSelectors) {
        subjectElement = row.querySelector(selector);
        if (subjectElement) {
          console.log(`[CONTENT DEBUG] Found subject with selector "${selector}"`);
          break;
        }
      }
      
      if (!subjectElement) {
        console.log(`[CONTENT DEBUG] No subject element found in row ${index}`);
        return;
      }
      
      // --- Robust subject extraction ---
      let subjectText = subjectElement.getAttribute('title') ||
                        subjectElement.textContent.trim() ||
                        subjectElement.innerText.trim() ||
                        '';

      // Debug: Show all possible subject values
      console.log(`[CONTENT DEBUG] subjectElement.title: "${subjectElement.getAttribute('title')}"`);
      console.log(`[CONTENT DEBUG] subjectElement.textContent: "${subjectElement.textContent}"`);
      console.log(`[CONTENT DEBUG] subjectElement.innerText: "${subjectElement.innerText}"`);
      console.log(`[CONTENT DEBUG] subjectText (used for matching): "${subjectText}"`);

      // Normalize the subject for comparison
      const normalizedSubjectText = normalizeSubject(subjectText);
      console.log(`[CONTENT DEBUG] normalizedSubjectText: "${normalizedSubjectText}"`);

      // Show all normalized tracked subjects
      const trackedEmailSubjects = Object.values(trackedEmails).map(e => normalizeSubject(e.subject));
      console.log(`[CONTENT DEBUG] All normalized tracked subjects:`, trackedEmailSubjects);

      // --- Robust matching: fuzzy and normalized ---
      const trackedEmail = Object.values(trackedEmails).find(email => {
        const normalizedTracked = normalizeSubject(email.subject);
        const match = email.opened && (
          normalizedTracked === normalizedSubjectText ||
          normalizedSubjectText.includes(normalizedTracked) ||
          normalizedTracked.includes(normalizedSubjectText)
        );
        console.log(`[CONTENT DEBUG] Comparing "${normalizedSubjectText}" with "${normalizedTracked}", opened: ${email.opened}, match: ${match}`);
        return match;
      });

      console.log(`[CONTENT DEBUG] Matched tracked email:`, trackedEmail);
      


      // Add indicator if needed
      if (trackedEmail && !row.querySelector('.email-read-indicator')) {
        console.log(`[CONTENT DEBUG] Adding tick mark for email:`, trackedEmail);
        
        const checkmark = document.createElement('span');
        checkmark.className = 'email-read-indicator';
        checkmark.textContent = '✓';
        checkmark.style.cssText = `
          color: #4CAF50 !important;
          margin-left: 8px !important;
          font-weight: bold !important;
          font-size: 14px !important;
          display: inline-block !important;
        `;
        checkmark.title = `Opened at ${new Date(trackedEmail.openedAt).toLocaleString()}`;
        
        subjectElement.appendChild(checkmark);
        console.log(`[CONTENT DEBUG] ✅ Tick mark added successfully`);
      } else if (trackedEmail) {
        console.log(`[CONTENT DEBUG] Tick mark already exists for this email`);
      }
    });
  } catch (error) {
    console.error("[CONTENT DEBUG] Error updating read indicators:", error);
  }
}

// Initial check and periodic updates
setInterval(throttledUpdate, 10000);
throttledUpdate();

// MANUAL TEST FUNCTION - Call this in console to test
window.testReadIndicators = updateReadIndicators;
