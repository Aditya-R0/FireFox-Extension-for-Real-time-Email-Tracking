# Firefox Email Tracker Extension

> Track Email Opens. In Real-Time. Without Compromising Privacy.

A lightweight, privacy-aware browser extension for Firefox that tracks when your emails are read — using invisible pixel injection, background polling, and modern web technologies. Built as a privacy-respecting alternative to commercial email tracking tools like Mailtrack.

---

## Key Features

- Automatic Pixel Injection  
  Seamlessly injects a unique, invisible tracking pixel into every outgoing email in Gmail.

- Real-Time Read Detection  
  Instantly notifies you when the recipient opens your email.

- Visual UI Indicators  
  Gmail Sent folder is updated with checkmarks to show open status.

- Privacy-First Architecture  
  No email content is read or stored. Only tracks open events.

- Modern Tech Stack  
  Built using Manifest V3, with a Flask + PostgreSQL backend, hosted on Render.com.

---

## Project Structure

### Frontend (`FireFox-email-tracker`)
```
📁 icons/                → Extension icons  
📄 background.js         → Polls backend for pixel open status  
📄 content.js            → Injects pixel and modifies Gmail UI  
📄 manifest.json         → Extension metadata (Manifest V3)
```

### Backend (`PixelGen`)
```
📁 views/                → Flask HTML views
📁 public/images/        → Tracking pixel assets  
📄 app.js                → Express/Flask backend logic  
📄 pixels.db             → SQLite or PostgreSQL DB  
📄 package.json         → Node.js dependencies  
```

---

## Installation & Testing Instructions

### For Frontend (Firefox Extension)

1. Open Firefox and navigate to `about:debugging`.
2. Click on "Load Temporary Add-on".
3. Select the `manifest.json` file from your `FireFox-email-tracker` directory.
4. Open Gmail and send an email — the extension will inject a tracking pixel.
5. Check your Sent folder — a checkmark will appear once the recipient opens it.

Note: Gmail must be in standard layout mode for the script to function correctly.

---

### For Backend (PixelGen Service)

1. Clone the backend repository:
   ```bash
   git clone https://github.com/Aditya-R0/PixelGen.git
   cd PixelGen
   ```

2. Backend will expose two main endpoints:
   - `POST /create` – Generate a new pixel linked to an email
   - `GET /check?id=<pixel_id>` – Poll for open status

3. Host this backend using Render.com.

---

## Assumptions & Notes

- Gmail DOM structure must remain standard. If Gmail layout changes significantly, the content script may require updates.
- Tracking depends on the recipient’s email client loading external images.
- Backend supports both SQLite (for local testing) and PostgreSQL (for deployment).
- You can easily extend with:
  - Email ID tagging
  - Timestamp logging
  - Analytics dashboard (React/Flask)

---

## Security & Privacy

- No access to email content  
- Pixel IDs are securely generated (UUID)  
- All communication uses HTTPS  
- Complies with GDPR-style minimal data policies

---

## Repository Links

- Frontend Extension: https://github.com/Aditya-R0/FireFox-email-tracker  
- Backend Service: https://github.com/Aditya-R0/PixelGen

---

## Built By

Developed by Aditya Rana and Dhruv Soni, with a focus on secure frontend-backend interaction and privacy-respecting tracking logic.

---

Enjoy seamless email tracking through a transparent and open-source solution.
