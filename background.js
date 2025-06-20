// Store tracked emails
chrome.storage.local.get('trackedEmails', (data) => {
  if (!data.trackedEmails) {
    chrome.storage.local.set({ trackedEmails: {} });
  }
});

// Listen for pixel open events (simulated)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'emailOpened') {
    handleEmailOpened(message.emailId);
  }
});

/**
 * Updates storage when email is opened
 */
function handleEmailOpened(emailId) {
  chrome.storage.local.get('trackedEmails', (data) => {
    const trackedEmails = data.trackedEmails || {};
    
    if (trackedEmails[emailId]) {
      trackedEmails[emailId].opened = true;
      trackedEmails[emailId].openedAt = Date.now();
      
      chrome.storage.local.set({ trackedEmails });
      sendNotification(trackedEmails[emailId]);
    }
  });
}

/**
 * Shows desktop notification
 */
function sendNotification(email) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-48.png',
    title: 'Email Opened',
    message: `${email.recipient} opened: ${email.subject}`
  });
}

// Simulate email opens for testing (remove in production)
setInterval(() => {
  chrome.storage.local.get('trackedEmails', (data) => {
    const emails = Object.keys(data.trackedEmails || {});
    if (emails.length > 0) {
      const randomEmailId = emails[Math.floor(Math.random() * emails.length)];
      handleEmailOpened(randomEmailId);
    }
  });
}, 30000); // Every 30 seconds
