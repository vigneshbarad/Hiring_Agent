// ============================================
// GROQ API CONFIGURATION
// ============================================
// API key and model are loaded from .env via the server.
// To change them, edit the .env file in the project root.

let GROQ_API_KEY = '';
let GROQ_MODEL = 'llama-3.1-8b-instant';

// Fetch config from server on load
const groqConfigReady = (async function loadGroqConfig() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        GROQ_API_KEY = config.apiKey || '';
        GROQ_MODEL = config.model || 'llama-3.1-8b-instant';
    } catch (e) {
        console.error('Failed to load API config:', e);
    }
})();

// ============================================
// GROQ API CALL
// ============================================
async function callGroqAPI(resumeText) {
    const prompt = `Analyze this resume text carefully. Extract ALL of the following:
- name: The candidate's full name
- email: Look for patterns like someone@domain.com anywhere in the text. Search thoroughly.
- phone: Look for phone number patterns like +91XXXXXXXXXX, (XXX) XXX-XXXX, XXX-XXX-XXXX, or any 10+ digit number. Search thoroughly.
- skills: Technical skills as an array of strings
- experience: Total years of experience as a single integer

IMPORTANT: Search the ENTIRE text for email and phone. They are often at the top of the resume near the name. If not found, return empty string.

Respond ONLY with a JSON object. No markdown. No explanation.
Exact format: {"name": "Jane Doe", "email": "jane@example.com", "phone": "+1234567890", "skills": ["Python", "Java"], "experience": 4}

Resume Text:
${resumeText}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                { role: "system", content: "You are a resume parser. Return ONLY valid JSON, no markdown, no explanation." },
                { role: "user", content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 500
        })
    });

    const data = await response.json();

    if (!response.ok) {
        const errMsg = data?.error?.message || JSON.stringify(data);
        throw new Error(`Groq API error (${response.status}): ${errMsg}`);
    }

    if (!data.choices || !data.choices[0]) {
        throw new Error("Invalid Groq response: " + JSON.stringify(data));
    }

    let rawText = data.choices[0].message.content;

    // Extract JSON from response
    const jsonStart = rawText.indexOf('{');
    const jsonEnd = rawText.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("No JSON found in AI response");
    }

    rawText = rawText.substring(jsonStart, jsonEnd + 1);
    return JSON.parse(rawText);
}
