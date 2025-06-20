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
