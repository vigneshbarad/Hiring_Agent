const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const nodemailer = require('nodemailer');

// Load .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    });
}

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // API endpoint: serve config from .env
    if (req.url === '/api/config') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            apiKey: process.env.FEATHERLESS_API_KEY || '',
            model: process.env.FEATHERLESS_MODEL || 'Qwen/Qwen2.5-7B-Instruct'
        }));
        return;
    }

    // API endpoint: send email
    if (req.url === '/api/send-email' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            try {
                const { to, subject, type, candidateName } = JSON.parse(body);

                if (!to || !candidateName) {
                    res.end(JSON.stringify({ success: false, error: 'Missing required fields' }));
                    return;
                }

                const smtpHost = process.env.SMTP_HOST;
                const smtpPort = parseInt(process.env.SMTP_PORT) || 587;
                const smtpUser = process.env.SMTP_USER;
                const smtpPass = process.env.SMTP_PASS;
                const fromEmail = process.env.FROM_EMAIL || smtpUser;
                const companyName = process.env.COMPANY_NAME || 'Drone Yodhas';

                if (!smtpHost || !smtpUser || !smtpPass) {
                    res.end(JSON.stringify({ success: false, error: 'Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env' }));
                    return;
                }

                const transporter = nodemailer.createTransport({
                    host: smtpHost,
                    port: smtpPort,
                    secure: smtpPort === 465,
                    auth: { user: smtpUser, pass: smtpPass }
                });

                let htmlBody;
                if (type === 'rejection') {
                    htmlBody = `
                        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background: #f8fafc; border-radius: 12px;">
                            <h2 style="color: #1e293b;">Dear ${candidateName},</h2>
                            <p style="color: #475569; line-height: 1.6;">Thank you for your interest in the position at <strong>${companyName}</strong> and for taking the time to apply.</p>
                            <p style="color: #475569; line-height: 1.6;">After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current requirements.</p>
                            <p style="color: #475569; line-height: 1.6;">We truly appreciate your effort and encourage you to apply for future openings that match your skills.</p>
                            <p style="color: #475569; line-height: 1.6;">We wish you all the best in your career journey.</p>
                            <p style="color: #1e293b; margin-top: 24px;">Best regards,<br><strong>${companyName} Hiring Team</strong></p>
                        </div>`;
                } else {
                    htmlBody = `
                        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background: #f8fafc; border-radius: 12px;">
                            <h2 style="color: #1e293b;">Dear ${candidateName},</h2>
                            <p style="color: #475569; line-height: 1.6;">We are pleased to inform you that your application at <strong>${companyName}</strong> has been shortlisted!</p>
                            <p style="color: #475569; line-height: 1.6;">Our team was impressed with your qualifications and experience. We would like to move forward with the next steps in the hiring process.</p>
                            <p style="color: #475569; line-height: 1.6;">A member of our team will reach out shortly to schedule an interview.</p>
                            <p style="color: #1e293b; margin-top: 24px;">Best regards,<br><strong>${companyName} Hiring Team</strong></p>
                        </div>`;
                }

                await transporter.sendMail({
                    from: `"${companyName}" <${fromEmail}>`,
                    to: to,
                    subject: subject,
                    html: htmlBody
                });

                console.log(`  📧 ${type} email sent to ${to}`);
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                console.error('  ❌ Email error:', err.message);
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(PUBLIC_DIR, decodeURIComponent(filePath));

    // Prevent directory traversal
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(PUBLIC_DIR))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n  ✅ Resume Screening Agent running at: ${url}\n`);
    console.log('  Project structure:');
    console.log('  public/index.html    — Main UI');
    console.log('  public/js/app.js     — App logic');
    console.log('  public/js/groq-api.js — Groq AI config');
    console.log('  public/css/styles.css — Styling\n');

    // Open in default browser (Windows)
    const platform = process.platform;
    if (platform === 'win32') {
        exec(`start ${url}`);
    } else if (platform === 'darwin') {
        exec(`open ${url}`);
    } else {
        exec(`xdg-open ${url}`);
    }
});
