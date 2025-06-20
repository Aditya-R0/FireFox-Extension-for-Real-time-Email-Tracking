// Store tracked emails
chrome.storage.local.get('trackedEmails', (data) => {
  if (!data.trackedEmails) {
    chrome.storage.local.set({ trackedEmails: {} });
  }
});

// Listen for messages from content script or server
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'emailOpened') {
    handleEmailOpened(message.emailId);
  }
});

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

function sendNotification(email) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-48.png',
    title: 'Email Opened',
    message: `${email.recipient} opened: ${email.subject}`
  });
}
