// ============================================
// Resume Screening Agent — Main App Logic
// ============================================

// Data Storage (localStorage-based)
const mockDataSdk = {
    storageKey: 'resume_agent_data',
    init: async () => ({ isOk: true }),
    create: async (record) => {
        let data = JSON.parse(localStorage.getItem('resume_agent_data') || '[]');
        const newRecord = { ...record, __backendId: Date.now().toString() };
        data.push(newRecord);
        localStorage.setItem('resume_agent_data', JSON.stringify(data));
        refreshData();
        return { isOk: true };
    },
    delete: async (record) => {
        let data = JSON.parse(localStorage.getItem('resume_agent_data') || '[]');
        data = data.filter(d => d.__backendId !== record.__backendId);
        localStorage.setItem('resume_agent_data', JSON.stringify(data));
        refreshData();
        return { isOk: true };
    }
};

let allData = [];
let currentFilter = 'all';
let requirements = { skills: ['React', 'TypeScript', 'Node.js', 'CSS'], minExp: 3, threshold: 60 };
let activeProfileName = 'Default';

// ============================================
// JOB PROFILES
// ============================================
function getProfiles() {
    return JSON.parse(localStorage.getItem('resume_agent_profiles') || '{}');
}

function saveProfiles(profiles) {
    localStorage.setItem('resume_agent_profiles', JSON.stringify(profiles));
}

function loadActiveProfile() {
    const saved = localStorage.getItem('resume_agent_active_profile');
    if (saved) activeProfileName = saved;
    const profiles = getProfiles();
    if (profiles[activeProfileName]) {
        requirements = profiles[activeProfileName];
    }
    updateHeaderJob();
}

function updateHeaderJob() {
    const el = document.getElementById('header-job');
    if (el) el.textContent = activeProfileName;
}

function switchProfile(name) {
    const profiles = getProfiles();
    if (!profiles[name]) return;
    activeProfileName = name;
    requirements = { ...profiles[name] };
    localStorage.setItem('resume_agent_active_profile', name);
    localStorage.setItem('resume_agent_requirements', JSON.stringify(requirements));
    updateHeaderJob();
    recalculateScores();
    showToast(`Switched to profile: ${name}`);
}

function saveCurrentAsProfile() {
    const name = document.getElementById('profile-name-input').value.trim();
    if (!name) { showToast('❌ Enter a profile name'); return; }
    const profiles = getProfiles();
    profiles[name] = { ...requirements };
    saveProfiles(profiles);
    activeProfileName = name;
    localStorage.setItem('resume_agent_active_profile', name);
    updateHeaderJob();
    renderProfileList();
    showToast(`Profile "${name}" saved`);
}

function deleteProfile(name) {
    if (!confirm(`Delete profile "${name}"?`)) return;
    const profiles = getProfiles();
    delete profiles[name];
    saveProfiles(profiles);
    if (activeProfileName === name) {
        activeProfileName = 'Default';
        localStorage.setItem('resume_agent_active_profile', activeProfileName);
        updateHeaderJob();
    }
    renderProfileList();
    showToast(`Profile "${name}" deleted`);
}

function renderProfileList() {
    const container = document.getElementById('profile-list');
    if (!container) return;
    const profiles = getProfiles();
    const names = Object.keys(profiles);
    if (names.length === 0) {
        container.innerHTML = '<p class="text-xs text-[#475569]">No saved profiles yet</p>';
        return;
    }
    container.innerHTML = names.map(name => `
        <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg ${name === activeProfileName ? 'bg-[#6d28d9]/20 border border-[#6d28d9]/40' : 'bg-[#0f172a] border border-[#334155]'}">
            <button onclick="switchProfile('${name.replace(/'/g, "\\'")}')" class="flex-1 text-left text-xs font-medium truncate ${name === activeProfileName ? 'text-[#a78bfa]' : 'text-[#cbd5e1]'}">${name}</button>
            <span class="text-[10px] text-[#64748b] flex-shrink-0">${profiles[name].skills.length} skills, ${profiles[name].minExp}yr</span>
            <button onclick="deleteProfile('${name.replace(/'/g, "\\'")}')" class="text-[#64748b] hover:text-red-400 flex-shrink-0"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
        </div>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function recalculateScores() {
    allData = allData.map(candidate => {
        const candidateSkills = candidate.skills.split(',').map(s => s.trim());
        const newScore = computeMatch(candidateSkills, candidate.experience_years);
        return { ...candidate, match_score: newScore, status: newScore >= requirements.threshold ? 'accepted' : 'declined' };
    });
    localStorage.setItem('resume_agent_data', JSON.stringify(allData));
    refreshData();
}

function loadRequirements() {
    const savedReqs = localStorage.getItem('resume_agent_requirements');
    if (savedReqs) requirements = JSON.parse(savedReqs);
    loadActiveProfile();
}

function refreshData() {
    allData = JSON.parse(localStorage.getItem('resume_agent_data') || '[]');
    updateStats();
    renderList();
}

function computeMatch(candidateSkills, candidateExp) {
    if (!Array.isArray(candidateSkills)) candidateSkills = [];
    
    const cSkills = candidateSkills.map(s => String(s).toLowerCase().trim());
    const rSkills = requirements.skills.map(s => String(s).toLowerCase().trim());
    let matched = 0;
    
    rSkills.forEach(rs => { 
        if (cSkills.some(cs => cs.includes(rs) || rs.includes(cs))) matched++; 
    });
    
    const skillScore = rSkills.length > 0 ? (matched / rSkills.length) * 70 : 70;
    const safeExp = Number(candidateExp) || 0;
    const reqExp = Number(requirements.minExp) || 1;
    const expScore = safeExp >= reqExp ? 30 : (safeExp / reqExp) * 30;
    
    return Math.round(skillScore + expScore);
}

// ============================================
// FILE UPLOAD HANDLING
// ============================================
async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Ensure API config is loaded before proceeding
    if (typeof groqConfigReady !== 'undefined') await groqConfigReady;

    if (!GROQ_API_KEY) {
        alert("API key not loaded. Make sure the server is running (npm start) and your .env file has GROQ_API_KEY set.");
        return;
    }

    const allowedExtensions = ['pdf', 'doc', 'docx', 'txt'];

    for (let file of files) {
        const ext = file.name.split('.').pop().toLowerCase();

        if (!allowedExtensions.includes(ext)) {
            showToast(`❌ Unsupported format: .${ext}. Please upload files in PDF, DOC, DOCX, or TXT format.`);
            continue;
        }

        showToast(`Reading ${file.name}...`);
        try {
            let text = '';

            if (ext === 'pdf') {
                text = await extractTextFromPDF(file);
            } else if (ext === 'doc' || ext === 'docx') {
                text = await extractTextFromDoc(file);
            } else {
                text = await file.text();
            }

            if (!text || !text.trim()) {
                showToast(`❌ No readable text found in ${file.name}`);
                continue;
            }

            await processWithAI(text, file.name);
        } catch (error) {
            console.error("Error reading file:", error);
            showToast(`❌ Could not read ${file.name}. Try a different format.`);
        }
    }
    event.target.value = '';
}

// ============================================
// PDF TEXT EXTRACTION (PDF.js)
// ============================================
async function extractTextFromPDF(file) {
    if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js library not loaded. Cannot read PDF files.');
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const arrayBuffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);
    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        let lastY = null;
        content.items.forEach(item => {
            if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
                fullText += '\n';
            } else if (fullText.length > 0 && !fullText.endsWith(' ') && !fullText.endsWith('\n')) {
                fullText += ' ';
            }
            fullText += item.str;
            lastY = item.transform[5];
        });
        fullText += '\n';
    }
    return fullText;
}

// DOCX extraction using mammoth.js, DOC fallback
async function extractTextFromDoc(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'docx') {
        if (typeof mammoth === 'undefined') {
            throw new Error('Mammoth.js library not loaded. Cannot read DOCX files.');
        }
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return result.value;
    }
    // .doc fallback — read as text (limited support)
    return await file.text();
}

// ============================================
// AI PROCESSING (uses Groq via groq-api.js)
// ============================================
async function processWithAI(resumeText, fileName) {
    showToast(`AI is analyzing ${fileName}...`);

    if (typeof groqConfigReady !== 'undefined') await groqConfigReady;

    if (!GROQ_API_KEY) {
        showToast('❌ Please add your Groq API key in .env');
        return;
    }

    try {
        const result = await callGroqAPI(resumeText);

        const safeSkills = Array.isArray(result.skills) ? result.skills : [];
        const safeExp = parseInt(result.experience) || 0; 
        const safeName = result.name || "Unknown Candidate";
        const safeEmail = result.email || '';
        const safePhone = result.phone || '';

        const score = computeMatch(safeSkills, safeExp);
        const status = score >= requirements.threshold ? 'accepted' : 'declined';

        await mockDataSdk.create({
            candidate_name: safeName,
            email: safeEmail,
            phone: safePhone,
            source: fileName,
            skills: safeSkills.join(', '),
            experience_years: safeExp,
            resume_text: resumeText,
            status: status,
            match_score: score, 
            submitted_at: new Date().toISOString()
        });
        
        showToast(`✅ ${safeName} screened! Match: ${score}%`);

    } catch (error) {
        console.error("AI processing failed for", fileName, error);
        showToast(`❌ AI failed to process ${fileName}: ${error.message}`);
    }
}

// ============================================
// UI FUNCTIONS
// ============================================
function updateStats() {
    const total = allData.length;
    const accepted = allData.filter(d => d.status === 'accepted').length;
    const declined = allData.filter(d => d.status === 'declined').length;
    const avg = total > 0 ? Math.round(allData.reduce((s, d) => s + (d.match_score || 0), 0) / total) : 0;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-accepted').textContent = accepted;
    document.getElementById('stat-declined').textContent = declined;
    document.getElementById('stat-avg').textContent = total > 0 ? avg + '%' : '-';
}

function renderList() {
    const container = document.getElementById('candidate-list');
    const filtered = currentFilter === 'all' ? allData : allData.filter(d => d.status === currentFilter);
    
    document.getElementById('empty-state').style.display = filtered.length === 0 ? 'block' : 'none';
    container.innerHTML = '';

    filtered.sort((a,b) => new Date(b.submitted_at) - new Date(a.submitted_at)).forEach(d => {
        const card = document.createElement('div');
        card.className = "anim-in rounded-xl p-4 bg-[#1e293b] border border-[#334155] hover:border-[#6d28d9] transition";
        
        const emailDisplay = d.email ? `<span class="text-[#a78bfa]">${d.email}</span>` : '<span class="text-[#475569]">No email</span>';
        const phoneDisplay = d.phone ? `<span class="text-[#a78bfa]">${d.phone}</span>` : '<span class="text-[#475569]">No phone</span>';
        
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-1 min-w-0">
                    <p class="font-bold">${d.candidate_name}</p>
                    <p class="text-xs text-[#64748b] mt-0.5">${d.experience_years}yr Exp • ${d.source}</p>
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                        <span class="text-xs flex items-center gap-1"><i data-lucide="mail" class="w-3 h-3 text-[#64748b]"></i> ${emailDisplay}</span>
                        <span class="text-xs flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3 text-[#64748b]"></i> ${phoneDisplay}</span>
                    </div>
                    <p class="text-xs text-[#64748b] mt-1.5 truncate" title="${d.skills}">Skills: ${d.skills || 'N/A'}</p>
                </div>
                <div class="text-right ml-4 flex-shrink-0">
                    <p class="text-lg font-bold mono ${d.match_score >= 80 ? 'text-green-400' : d.match_score >= 60 ? 'text-yellow-400' : 'text-red-400'}">${d.match_score || 0}%</p>
                    <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${d.status === 'accepted' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}">${d.status}</span>
                </div>
            </div>
            <div class="flex items-center gap-2 mt-3 pt-3 border-t border-[#334155] flex-wrap">
                ${d.resume_text ? `<button onclick="event.stopPropagation(); viewResume('${d.__backendId}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-[#6d28d9]/30 text-[#a78bfa] hover:bg-[#6d28d9]/50 transition"><i data-lucide="file-text" class="w-3 h-3"></i> View Resume</button>` : ''}
                ${d.status === 'declined' ? `<button onclick="event.stopPropagation(); forceStatus('${d.__backendId}', 'accepted')" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-green-900/50 text-green-300 hover:bg-green-900 transition"><i data-lucide="check-circle" class="w-3 h-3"></i> Force Accept</button>` : ''}
                ${d.status === 'accepted' ? `<button onclick="event.stopPropagation(); forceStatus('${d.__backendId}', 'declined')" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-red-900/50 text-red-300 hover:bg-red-900 transition"><i data-lucide="x-circle" class="w-3 h-3"></i> Force Decline</button>` : ''}
                ${d.status === 'declined' && d.email ? `<button onclick="event.stopPropagation(); sendRejectionEmail('${d.candidate_name.replace(/'/g, "\\'") }', '${d.email}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-red-900/50 text-red-300 hover:bg-red-900 transition"><i data-lucide="mail-x" class="w-3 h-3"></i> Send Rejection</button>` : ''}
                ${d.status === 'accepted' && d.email ? `<button onclick="event.stopPropagation(); sendAcceptanceEmail('${d.candidate_name.replace(/'/g, "\\'") }', '${d.email}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-green-900/50 text-green-300 hover:bg-green-900 transition"><i data-lucide="mail-check" class="w-3 h-3"></i> Send Acceptance</button>` : ''}
                <button onclick="event.stopPropagation(); if(confirm('Delete this record?')) mockDataSdk.delete(${JSON.stringify(d).replace(/'/g, "\\'")})" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-[#0f172a] text-[#64748b] hover:text-red-400 transition ml-auto"><i data-lucide="trash-2" class="w-3 h-3"></i> Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function openRequirements() {
    document.getElementById('req-skills').value = requirements.skills.join(', ');
    document.getElementById('req-exp').value = requirements.minExp;
    document.getElementById('req-threshold').value = requirements.threshold;
    document.getElementById('profile-name-input').value = activeProfileName;
    renderProfileList();
    document.getElementById('modal-requirements').style.display = 'flex';
}

function saveRequirements() {
    requirements.skills = document.getElementById('req-skills').value.split(',').map(s => s.trim()).filter(Boolean);
    requirements.minExp = parseInt(document.getElementById('req-exp').value) || 0;
    requirements.threshold = parseInt(document.getElementById('req-threshold').value) || 0;
    localStorage.setItem('resume_agent_requirements', JSON.stringify(requirements));

    // Auto-save to active profile
    const profiles = getProfiles();
    profiles[activeProfileName] = { ...requirements };
    saveProfiles(profiles);

    closeModals();
    showToast("Requirements updated");
    recalculateScores();
}

function setFilter(f) {
    currentFilter = f;
    document.querySelectorAll('[id^="filter-"]').forEach(btn => {
        btn.className = btn.id === `filter-${f}` 
            ? "px-3 py-1.5 rounded-full text-xs font-semibold bg-[#6d28d9] text-white"
            : "px-3 py-1.5 rounded-full text-xs font-semibold bg-[#1e293b] text-[#64748b] border border-[#334155]";
    });
    renderList();
}

function closeModals() { document.querySelectorAll('[id^="modal-"]').forEach(m => m.style.display = 'none'); }

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}

window.onload = () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    loadRequirements(); 
    refreshData();

    // Close upload menu when clicking outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('upload-menu');
        const btn = document.getElementById('upload-btn');
        if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });
};

function toggleUploadMenu() {
    document.getElementById('upload-menu').classList.toggle('hidden');
}

function hideUploadMenu() {
    document.getElementById('upload-menu').classList.add('hidden');
}

function openProfileSwitcher() {
    openRequirements();
}

function clearAllData() {
    if (!allData.length) { showToast('No data to clear'); return; }
    if (!confirm(`Delete all ${allData.length} candidate(s)? This cannot be undone.`)) return;
    localStorage.removeItem('resume_agent_data');
    allData = [];
    refreshData();
    showToast('All candidate data cleared');
}

function viewResume(backendId) {
    const candidate = allData.find(d => d.__backendId === backendId);
    if (!candidate || !candidate.resume_text) { showToast('No resume text available'); return; }
    document.getElementById('resume-viewer-title').textContent = `${candidate.candidate_name} — ${candidate.source}`;
    document.getElementById('resume-viewer-content').textContent = candidate.resume_text;
    document.getElementById('modal-resume-viewer').style.display = 'flex';
}

function forceStatus(backendId, newStatus) {
    allData = allData.map(d => d.__backendId === backendId ? { ...d, status: newStatus } : d);
    localStorage.setItem('resume_agent_data', JSON.stringify(allData));
    refreshData();
    showToast(`Candidate ${newStatus === 'accepted' ? '✅ accepted' : '❌ declined'} manually`);
}

// ============================================
// EMAIL SENDING
// ============================================
async function sendRejectionEmail(name, email) {
    if (!confirm(`Send rejection email to ${name} (${email})?`)) return;
    
    showToast(`Sending rejection email to ${email}...`);
    try {
        const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: email,
                subject: `Application Update — ${name}`,
                type: 'rejection',
                candidateName: name
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`✅ Rejection email sent to ${email}`);
        } else {
            showToast(`❌ Failed to send email: ${data.error}`);
        }
    } catch (err) {
        console.error('Email send error:', err);
        showToast(`❌ Email failed: ${err.message}`);
    }
}

async function sendAcceptanceEmail(name, email) {
    if (!confirm(`Send acceptance email to ${name} (${email})?`)) return;
    
    showToast(`Sending acceptance email to ${email}...`);
    try {
        const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: email,
                subject: `Application Update — ${name}`,
                type: 'acceptance',
                candidateName: name
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`✅ Acceptance email sent to ${email}`);
        } else {
            showToast(`❌ Failed to send email: ${data.error}`);
        }
    } catch (err) {
        console.error('Email send error:', err);
        showToast(`❌ Email failed: ${err.message}`);
    }
}

// ============================================
// BULK EMAIL SENDING
// ============================================
async function sendBulkRejectionEmails() {
    const declined = allData.filter(d => d.status === 'declined' && d.email);
    if (declined.length === 0) {
        showToast('❌ No declined candidates with email addresses found.');
        return;
    }
    if (!confirm(`Send rejection emails to ${declined.length} declined candidate(s)?`)) return;

    let sent = 0, failed = 0;
    for (const d of declined) {
        try {
            const res = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: d.email,
                    subject: `Application Update — ${d.candidate_name}`,
                    type: 'rejection',
                    candidateName: d.candidate_name
                })
            });
            const data = await res.json();
            if (data.success) sent++; else failed++;
        } catch { failed++; }
    }
    showToast(`✅ Rejection emails: ${sent} sent, ${failed} failed`);
}

async function sendBulkAcceptanceEmails() {
    const accepted = allData.filter(d => d.status === 'accepted' && d.email);
    if (accepted.length === 0) {
        showToast('❌ No accepted candidates with email addresses found.');
        return;
    }
    if (!confirm(`Send acceptance emails to ${accepted.length} accepted candidate(s)?`)) return;

    let sent = 0, failed = 0;
    for (const d of accepted) {
        try {
            const res = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: d.email,
                    subject: `Application Update — ${d.candidate_name}`,
                    type: 'acceptance',
                    candidateName: d.candidate_name
                })
            });
            const data = await res.json();
            if (data.success) sent++; else failed++;
        } catch { failed++; }
    }
    showToast(`✅ Acceptance emails: ${sent} sent, ${failed} failed`);
}
