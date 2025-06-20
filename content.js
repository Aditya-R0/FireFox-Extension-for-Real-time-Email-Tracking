// Track compose windows
const composeObserver = new MutationObserver(() => {
  const composeBox = document.querySelector('[aria-label="Message Body"]');
  if (composeBox && !composeBox.dataset.trackerAdded) {
    composeBox.dataset.trackerAdded = "true";
    setupComposerTracking(composeBox);
  }
});

// Track inbox for read indicators
const inboxObserver = new MutationObserver(() => {
  if (location.href.includes("inbox")) updateInboxIndicators();
});

// Start observers
composeObserver.observe(document.body, { childList: true, subtree: true });
inboxObserver.observe(document.body, { childList: true, subtree: true });

// Initialize immediately
updateInboxIndicators();

/**
 * Sets up tracking for a compose window
 */
function setupComposerTracking(composeBox) {
  const sendButton = document.querySelector('[aria-label="Send"]');
  if (!sendButton) return;

  sendButton.addEventListener('click', async () => {
    const subject = document.querySelector('[name="subjectbox"]')?.value || "No Subject";
    const recipient = document.querySelector('[name="to"]')?.textContent || "Unknown";
    
    // Generate and inject tracking pixel
    const pixelUrl = await createTrackingPixel(subject, recipient);
    injectPixel(composeBox, pixelUrl);
  });
}

/**
 * Creates a tracking pixel via Render server
 */
async function createTrackingPixel(subject, recipient) {
  const response = await fetch('https://your-render-app.onrender.com/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, recipient })
  });
  const data = await response.json();
  return data.url;
}

/**
 * Injects pixel into email body
 */
function injectPixel(composeBox, url) {
  const pixel = document.createElement('img');
  pixel.src = url;
  pixel.style.display = 'none';
  pixel.alt = '';
  composeBox.appendChild(pixel);
}

/**
 * Adds read indicators to inbox
 */
async function updateInboxIndicators() {
  const emails = document.querySelectorAll('div[role="main"] tr[role="row"]');
  
  // Get tracking data from background
  const { trackedEmails = {} } = await chrome.storage.local.get('trackedEmails');
  
  emails.forEach(email => {
    const subjectEl = email.querySelector('[data-legacy-thread-id] span');
    if (!subjectEl || email.querySelector('.email-tracker-icon')) return;
    
    const subject = subjectEl.textContent.trim();
    const emailId = email.dataset.legacyThreadId;
    
    // Check if email has been opened
    if (trackedEmails[emailId]?.opened) {
      const icon = document.createElement('span');
      icon.className = 'email-tracker-icon';
      icon.innerHTML = '✅';
      icon.style.marginLeft = '8px';
      subjectEl.parentNode.appendChild(icon);
    }
  });
}
