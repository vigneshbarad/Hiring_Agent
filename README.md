# Resume Screening Agent

AI-powered resume screening tool that parses resumes, scores candidates against job requirements, and sends acceptance/rejection emails — all from a single dashboard.

Built with **Node.js**, **Groq AI (LLaMA 3.1)**, **PDF.js**, **Mammoth.js**, and **Nodemailer**.

---

## Features

- Upload resumes (PDF, DOCX, DOC, TXT) individually or as a folder
- AI extracts candidate name, email, phone, skills, and experience
- Scores candidates against configurable job requirements
- Accept/Decline candidates based on match threshold
- Send individual or bulk acceptance/rejection emails via Gmail
- Dark-themed responsive UI with Tailwind CSS

---

## Project Structure

```
hackathon/
├── server.js              # Node.js HTTP server + API endpoints
├── package.json           # Project config and dependencies
├── .env                   # API keys and email config (not committed)
├── .gitignore             # Ignores .env, node_modules
├── public/                # Frontend (served by server.js)
│   ├── index.html         # Main UI
│   ├── css/styles.css     # Custom styles
│   ├── js/groq-api.js     # Groq AI API communication
│   ├── js/app.js          # App logic (upload, parse, render, email)
│   └── main.js            # Entry point (module loader)
└── resumes/               # Place sample resumes here
```

---

## Prerequisites

- **Node.js** v16 or higher — [Download here](https://nodejs.org/)
- **Groq API Key** — [Get one free at console.groq.com](https://console.groq.com/)
- **Gmail App Password** (for email feature) — see [Email Setup](#email-setup) below

---

## Installation

### 1. Clone or download the project

```bash
cd hackathon
```

### 2. Install dependencies

```bash
npm install
```

This installs `nodemailer` (the only dependency).

### 3. Configure environment variables

Create a `.env` file in the project root (or edit the existing one):

```env
GROQ_API_KEY=your-groq-api-key-here
GROQ_MODEL=llama-3.1-8b-instant

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
FROM_EMAIL=your-email@gmail.com
COMPANY_NAME=Drone Yodhas
```

> **Important:** Never commit your `.env` file. It's already in `.gitignore`.

### 4. Start the server

```bash
npm start
```

Or directly:

```bash
node server.js
```

The app opens automatically in your browser at **http://localhost:3000**.

---

## How to Use

1. **Set Requirements** — Click the "Requirements" button to set required skills, minimum experience, and match threshold.
2. **Upload Resumes** — Click "Screen Resumes" to upload files or an entire folder.
3. **View Results** — Candidates appear with match scores. Use filters (All / Accepted / Declined).
4. **Send Emails** — Use individual or bulk email buttons to notify candidates.

---

## Email Setup

To send emails via Gmail:

1. Go to [myaccount.google.com](https://myaccount.google.com/)
2. Navigate to **Security** → **2-Step Verification** (enable it if not already)
3. Scroll down and click **App passwords**
4. Select app: **Mail**, device: **Windows Computer**
5. Click **Generate** — copy the 16-character password
6. Paste it as `SMTP_PASS` in your `.env` file

> **Note:** Use the App Password, NOT your regular Gmail password.

---

## API Endpoints (served by server.js)

| Endpoint           | Method | Description                          |
|--------------------|--------|--------------------------------------|
| `/api/config`      | GET    | Returns Groq API key and model name  |
| `/api/send-email`  | POST   | Sends acceptance/rejection email     |

---

## Tech Stack

| Component     | Technology                        |
|---------------|-----------------------------------|
| Server        | Node.js (vanilla HTTP)            |
| AI Model      | Groq — LLaMA 3.1 8B Instant      |
| PDF Parsing   | PDF.js (CDN)                      |
| DOCX Parsing  | Mammoth.js (CDN)                  |
| Email         | Nodemailer + Gmail SMTP           |
| Frontend      | Tailwind CSS, Lucide Icons        |
| Data Storage  | Browser localStorage              |

---

## Troubleshooting

| Problem                        | Solution                                                        |
|--------------------------------|-----------------------------------------------------------------|
| Port 3000 already in use       | Kill the process: `npx kill-port 3000` then restart             |
| Gmail 535 auth error           | Use an App Password, not your regular password                  |
| PDF not reading                | Make sure the PDF has selectable text (not scanned images)      |
| AI returns empty results       | Check your Groq API key in `.env`                               |
| Icons not showing              | Hard refresh the browser (`Ctrl + Shift + R`)                   |

---

## License

MIT
