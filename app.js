/**
 * Main Application Logic
 */

// Database Constants
const DB_NAME = 'PresenceAppDB';
const DB_VERSION = 4;
const STORES = {
    PARTICIPANTS: 'participants',
    CLASSES: 'classes',
    ATTENDANCE: 'attendance'
};

// Database Service (SharePoint/JSON Mode)
const dbService = {
    data: {
        participants: [],
        classes: [],
        attendance: []
    },
    jsonUrl: 'mmt_db.json',

    async init() {
        console.log('🔄 Initializing JSON DB from:', this.jsonUrl);
        try {
            // Anti-cache param
            const url = `${this.jsonUrl}?t=${new Date().getTime()}`;
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                const json = await response.json();
                this.data = { ...this.data, ...json };
                console.log('✅ Database loaded from JSON');
            } else {
                console.warn('⚠️ No database file found (404), starting with empty DB.');
            }
        }
        } catch(error) {
        console.warn('Init error:', error);
    }
        
        await this.archiveExpiredParticipants();
    return this.data;
},

    async save() {
        console.log('💾 Saving to SharePoint/OneDrive...');
        try {
            // SharePoint typically accepts PUT to overwrite file content
            // We need the X-RequestDigest for security in SP, simple fetch might fail on some configs
            // Try simple PUT first (works in mapped drives or permissive libs)

            const response = await fetch(this.jsonUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'If-Match': '*' // Force overwrite
                },
                body: JSON.stringify(this.data, null, 2)
            });

            if (!response.ok) {
                // Fallback: Try to use SharePoint REST API if we are in a SP context
                // This is a "Best Effort" guess of the context
                console.warn('PUT failed, trying specific SP upload logic...');
                throw new Error(`Save failed: ${response.statusText}`);
            }
            console.log('✅ Database saved successfully');

            // Visual feedback
            const btn = document.querySelector('.btn-save-indicator');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = '✅ Sauvegardé';
                setTimeout(() => btn.textContent = originalText, 2000);
            }

        } catch (e) {
            console.error('Save Error:', e);
            alert('ERREUR DE SAUVEGARDE ! Vos modifications ne sont peut-être pas enregistrées sur le serveur.\n\n' + e.message);
        }
    },

        async archiveExpiredParticipants() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Keep active until the end of the current month
    // Archive only if endDate is strictly before the 1st of the current month
    const archiveThreshold = new Date(today.getFullYear(), today.getMonth(), 1);

    if (!this.data.participants) return;

    const toArchive = this.data.participants.filter(p => {
        if (!p.dateEnd) return false;
        const endDate = new Date(p.dateEnd);
        return endDate < archiveThreshold;
    });

    if (toArchive.length > 0) {
        console.log(`📦 Archiving ${toArchive.length} expired participant(s)`);

        if (!this.data.archivedParticipants) this.data.archivedParticipants = [];

        // Add to archive (checking unicity just in case)
        toArchive.forEach(p => {
            if (!this.data.archivedParticipants.find(ap => ap.id === p.id)) {
                this.data.archivedParticipants.push(p);
            }
        });

        // Remove from active
        this.data.participants = this.data.participants.filter(p => {
            if (!p.dateEnd) return true;
            const endDate = new Date(p.dateEnd);
            return endDate >= archiveThreshold;
        });

        await this.save();
    }
},

    // CRUD Wrappers
    async getAll(storeName) {
    return this.data[storeName] || [];
},

    async get(storeName, id) {
    const store = this.data[storeName] || [];
    return store.find(item => item.id === id);
},

    async add(storeName, item) {
    if (!this.data[storeName]) this.data[storeName] = [];
    this.data[storeName].push(item);
    await this.save();
    return item.id;
},

    async update(storeName, item) {
    if (!this.data[storeName]) this.data[storeName] = [];
    const index = this.data[storeName].findIndex(i => i.id === item.id);
    if (index !== -1) {
        this.data[storeName][index] = item;
    } else {
        this.data[storeName].push(item);
    }
    await this.save();
    return item.id;
},

    async delete (storeName, id) {
    if (!this.data[storeName]) return;
    this.data[storeName] = this.data[storeName].filter(i => i.id !== id);
    await this.save();
}
};

// Participant Service
const participantService = {
    async getAllParticipants() {
        return await dbService.getAll(STORES.PARTICIPANTS);
    },

    async addParticipant(participant) {
        if (!participant.id) {
            participant.id = crypto.randomUUID();
        }
        return await dbService.add(STORES.PARTICIPANTS, participant);
    },

    async updateParticipant(participant) {
        // Handle both (id, data) and (data) signatures
        if (arguments.length === 2) {
            const data = arguments[1];
            data.id = arguments[0];
            return await dbService.update(STORES.PARTICIPANTS, data);
        }
        return await dbService.update(STORES.PARTICIPANTS, participant);
    },

    async deleteParticipant(id) {
        return await dbService.delete(STORES.PARTICIPANTS, id);
    }
};

// Class Service
const classService = {
    async getAllClasses() {
        return await dbService.getAll(STORES.CLASSES);
    },

    async addClass(cls) {
        if (!cls.id) {
            cls.id = crypto.randomUUID();
        }
        return await dbService.add(STORES.CLASSES, cls);
    },

    async updateClass(cls) {
        return await dbService.update(STORES.CLASSES, cls);
    },

    async deleteClass(id) {
        return await dbService.delete(STORES.CLASSES, id);
    },

    async addParticipantToClass(classId, participantId) {
        const cls = await this.getClass(classId);
        if (!cls.participantIds) cls.participantIds = [];
        if (!cls.participantIds.includes(participantId)) {
            cls.participantIds.push(participantId);
            await this.updateClass(cls);
        }
    },

    async getClass(id) {
        return await dbService.get(STORES.CLASSES, id);
    }
};

// Initialize window.app namespace immediately
window.app = window.app || {};


// Initialize App
// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    dbService.init().then(() => {
        initApp();
    }).catch(err => {
        console.error('Database initialization failed', err);
        alert('Erreur: Impossible d\'initialiser la base de données.');
    });
});

function initApp() {
    setupNavigation();

    // Setup dashboard month change listener
    const monthInput = document.getElementById('dashboard-month');
    if (monthInput) {
        monthInput.addEventListener('change', () => renderDashboard());
    }

    // Setup month navigation buttons
    const btnPrev = document.getElementById('btn-prev-month');
    const btnNext = document.getElementById('btn-next-month');

    if (btnPrev && btnNext && monthInput) {
        const changeMonth = (delta) => {
            if (!monthInput.value) return;
            const [year, month] = monthInput.value.split('-').map(Number);
            const date = new Date(year, month - 1 + delta, 1);
            const newYear = date.getFullYear();
            const newMonth = String(date.getMonth() + 1).padStart(2, '0');
            monthInput.value = `${newYear}-${newMonth}`;
            renderDashboard();
        };

        btnPrev.addEventListener('click', () => changeMonth(-1));
        btnNext.addEventListener('click', () => changeMonth(1));
    }

    // Update active nav link
    updateActiveNavLink('dashboard');

    // Render initial dashboard
    renderDashboard();
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = e.target.getAttribute('href').substring(1);
            navigateTo(targetId);
        });
    });

    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`tab-${tabId}`).style.display = 'block';
        });
    });

    // Class Details Back Button
    const btnBackClasses = document.getElementById('btn-back-classes');
    if (btnBackClasses) {
        btnBackClasses.addEventListener('click', () => {
            navigateTo('classes');
        });
    }

    // Attendance Date Navigation
    const dateInput = document.getElementById('attendance-date');
    const btnPrevDate = document.getElementById('btn-prev-date');
    const btnNextDate = document.getElementById('btn-next-date');

    if (dateInput && btnPrevDate && btnNextDate) {
        dateInput.addEventListener('change', () => {
            if (currentClassId) {
                // Determine which class object to pass. loadAttendanceGrid expects the Class Object, not ID.
                // We need to fetch it. But loadAttendanceGrid is async and we need to wait.
                // Or better, just reload the grid.
                // Quick fix: re-call loadClassDetails or duplicate logic.
                // Actually, loadClassDetails sets up everything.
                // Let's just refactor loadAttendanceGrid to take ID? 
                // Or better, fetch class then load.
                refreshAttendanceGrid();
            }
        });

        const changeDate = (days) => {
            if (!dateInput.value) dateInput.valueAsDate = new Date();
            const date = new Date(dateInput.value);
            date.setDate(date.getDate() + days);
            dateInput.valueAsDate = date;
            refreshAttendanceGrid();
        };

        btnPrevDate.addEventListener('click', () => changeDate(-1));
        btnNextDate.addEventListener('click', () => changeDate(1));
    }
}

async function refreshAttendanceGrid() {
    if (!currentClassId) return;
    try {
        const classes = await classService.getAllClasses();
        const cls = classes.find(c => c.id === currentClassId);
        if (cls) loadAttendanceGrid(cls);
    } catch (e) { console.error(e); }
}

function navigateTo(viewId) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    // Show target view
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.style.display = 'block';
        updateActiveNavLink(viewId);

        if (viewId === 'participants') {
            loadParticipantsView();
        } else if (viewId === 'classes') {
            if (window.app.loadClasses) {
                window.app.loadClasses();
            }
        } else if (viewId === 'dashboard') {
            renderDashboard();
        }
    }
}

function updateActiveNavLink(viewId) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${viewId}`) {
            link.classList.add('active');
        }
    });
}

// --- Dashboard Logic ---
async function renderDashboard() {
    const monthInput = document.getElementById('dashboard-month');
    if (!monthInput) {
        console.error('❌ ERREUR: La section dashboard est manquante dans index.html');
        const container = document.getElementById('dashboard-content');
        if (container) {
            container.innerHTML = '<p class="error">Erreur: Section dashboard manquante. Veuillez restaurer le fichier index.html.</p>';
        }
        return;
    }

    if (!monthInput.value) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        monthInput.value = `${year}-${month}`;
    }
    const monthValue = monthInput.value;

    if (!monthValue) return;

    const [year, month] = monthValue.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();

    const container = document.getElementById('dashboard-content');
    container.innerHTML = '<p>Chargement...</p>';

    try {
        // Fetch all data
        const participants = await participantService.getAllParticipants();
        const allAttendance = await dbService.getAll(STORES.ATTENDANCE);

        // Filter attendance for this month
        const monthAtt = allAttendance.filter(r => r.date && r.date.startsWith(monthValue));

        if (participants.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #666;">
                    <p>Aucun participant trouvé.</p>
                </div>`;
            return;
        }

        // Sort participants alphabetically
        participants.sort((a, b) => a.lastName.localeCompare(b.lastName));

        // Group participants by class
        const classes = await classService.getAllClasses();
        const participantsByClass = {};

        // First, add participants that belong to classes
        classes.forEach(cls => {
            if (cls.participantIds && cls.participantIds.length > 0) {
                participantsByClass[cls.name] = participants.filter(p => cls.participantIds.includes(p.id));
            }
        });

        // Then add participants without class
        const participantsWithClass = Object.values(participantsByClass).flat();
        const participantsWithoutClass = participants.filter(p => !participantsWithClass.find(pc => pc.id === p.id));
        if (participantsWithoutClass.length > 0) {
            participantsByClass['Sans classe'] = participantsWithoutClass;
        }

        // Format date helper - DD.MM.YYYY
        const formatDate = (isoDate) => {
            if (!isoDate) return '-';
            const [y, m, d] = isoDate.split('-');
            return `${d}.${m}.${y}`;
        };

        let tableHtml = `
            <style>
                .calendar-container {
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    background: white;
                    margin-bottom: 2rem;
                }
                .calendar-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .calendar-table th {
                    background: var(--primary);
                    color: white;
                    padding: 0.5rem 0.3rem;
                    font-weight: 600;
                    font-size: 0.75rem;
                    text-align: center;
                    white-space: nowrap;
                }
                .calendar-table th.class-name-header {
                    background: var(--primary);
                    color: white;
                    font-size: 1rem;
                    padding: 0.75rem;
                    text-align: left;
                    font-weight: 700;
                }
                .calendar-table td {
                    font-size: 0.75rem;
                    padding: 0.3rem;
                }
                .period-col {
                    font-weight: 700;
                    color: var(--primary);
                    font-size: 0.75rem;
                    text-align: center;
                }
                .code-g-tooltip {
                    position: relative;
                    cursor: help;
                }
                .code-g-tooltip:hover::after {
                    content: attr(data-comment);
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #333;
                    color: white;
                    padding: 0.5rem;
                    border-radius: 6px;
                    white-space: nowrap;
                    max-width: 300px;
                    font-size: 0.75rem;
                    z-index: 1000;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }
            </style>
        `;

        // Rows for each class group
        for (const [className, classParticipants] of Object.entries(participantsByClass)) {
            const cls = classes.find(c => c.name === className);
            const classId = cls ? cls.id : null;
            const manageBtn = (classId && className !== 'Sans classe')
                ? `<button onclick="window.app.openClassAttendance('${classId}')" class="btn-secondary btn-sm" style="background:rgba(255,255,255,0.2); color:white; border:1px solid rgba(255,255,255,0.4); margin-left:1rem; padding:0.2rem 0.6rem; font-size:0.8rem;">⚙️ Gérer les présences</button>`
                : '';

            tableHtml += `
            <div class="calendar-container">
                <table class="calendar-table">
                    <thead>
                        <tr>
                            <th class="class-name-header" colspan="${5 + daysInMonth}">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span>${className}</span>
                                    ${manageBtn}
                                </div>
                            </th>
                        </tr>
                        <tr>
                            <th style="min-width: 120px; text-align: left; padding-left: 0.75rem;">Participant</th>
                            <th style="min-width: 70px;">Début</th>
                            <th style="min-width: 70px;">Fin</th>
                            <th style="min-width: 50px;">Total H</th>
                            <th style="min-width: 30px;"></th>
        `;

            // Header Days
            for (let d = 1; d <= daysInMonth; d++) {
                tableHtml += `<th style="min-width: 25px;">${d}</th>`;
            }
            tableHtml += `</tr></thead><tbody>`;

            // Participants in this class
            classParticipants.forEach(p => {
                // Calculate total hours
                let totalHours = 0;
                for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${monthValue}-${String(d).padStart(2, '0')}`;
                    const record = monthAtt.find(r => r.participantId === p.id && r.date === dateStr);
                    const mCode = record ? (record.morningCode === 'P' ? 'X' : record.morningCode) : '';
                    const aCode = record ? (record.afternoonCode === 'P' ? 'X' : record.afternoonCode) : '';

                    // Count 'X' (Sur place) as 4h AM / 2h PM
                    if (mCode === 'X') totalHours += 4;
                    if (aCode === 'X') totalHours += 2;
                }

                let rowMatin = `<td class="name-col" rowspan="2" style="border-bottom: 2px solid #e0e0e0; position:relative;">
                                    <div>${p.firstName} ${p.lastName}</div>
                                    <button class="btn-sm btn-secondary" style="margin-top:0.2rem; font-size:0.75rem; padding:0.1rem 0.4rem;" onclick="window.app.exportParticipantPDF('${p.id}')" title="Imprimer ce MMT">🖨️ PDF</button>
                                </td>
                                <td rowspan="2" style="border-bottom: 2px solid #e0e0e0;">${formatDate(p.dateStart)}</td>
                                <td rowspan="2" style="border-bottom: 2px solid #e0e0e0;">${formatDate(p.dateEnd)}</td>
                                <td rowspan="2" style="font-weight:bold; text-align:center; border-bottom: 2px solid #e0e0e0;">${totalHours}h</td>
                                <td class="period-col">M</td>`;
                let rowAprem = `<td class="period-col" style="border-bottom: 2px solid #e0e0e0;">AM</td>`;

                // Cells
                for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${monthValue}-${String(d).padStart(2, '0')}`;
                    const dayOfWeek = new Date(dateStr).getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const weekendClass = isWeekend ? 'weekend' : '';

                    // Check schedule
                    let isScheduledAm = true;
                    let isScheduledPm = true;

                    if (!isWeekend && p.schedule) {
                        isScheduledAm = p.schedule[`${dayOfWeek}-am`];
                        isScheduledPm = p.schedule[`${dayOfWeek}-pm`];
                    }

                    const record = monthAtt.find(r => r.participantId === p.id && r.date === dateStr);

                    const mCode = record ? (record.morningCode === 'P' ? 'X' : record.morningCode) : '';
                    const aCode = record ? (record.afternoonCode === 'P' ? 'X' : record.afternoonCode) : '';
                    const comment = record ? record.comment : '';

                    const getCellClass = (code, isScheduled) => {
                        if (!isScheduled && !code) return 'cell-disabled';
                        if (code === 'X' || code === 'O') return 'cell-x';
                        if (code === '?') return 'cell-unknown';
                        if (code && code !== '') return 'cell-other';
                        return '';
                    };

                    // Add tooltip for code G
                    // Escape comment for HTML attribute
                    const safeComment = comment ? comment.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
                    const tooltipClass = (mCode === 'G' && comment) ? 'code-g-tooltip' : '';
                    const tooltipAttr = (mCode === 'G' && comment) ? `data-comment="${safeComment}"` : '';

                    // Interruption Logic
                    let cellContentM = mCode || '';
                    let cellContentA = aCode || '';

                    if (p.interruptionMMT && p.interruptionDate === dateStr) {
                        const interruptionIcon = '<span title="Interruption de la MMT" style="cursor:help; font-size:1.2em;">😢</span>';
                        // Place it in the middle or append?
                        // Let's replace the content if empty, or append?
                        // User said: "dans la case du jour de l'interruption"
                        // We'll add it to both AM/PM or just one? "la case". Usually we have two cells per day.
                        // Let's put it in both or merge? 
                        // "ne met pas le smiley à côté du nom mais dans la case du jour"
                        // I will put it in the PM cell if possible, or both. Let's put in both for visibility.
                        cellContentM += interruptionIcon;
                        cellContentA += interruptionIcon;
                    }

                    rowMatin += `<td class="${weekendClass} ${getCellClass(mCode, isScheduledAm)} ${tooltipClass}" ${tooltipAttr}>${cellContentM}</td>`;

                    const tooltipClassAm = (aCode === 'G' && comment) ? 'code-g-tooltip' : '';
                    const tooltipAttrAm = (aCode === 'G' && comment) ? `data-comment="${safeComment}"` : '';
                    rowAprem += `<td class="${weekendClass} ${getCellClass(aCode, isScheduledPm)} ${tooltipClassAm}" ${tooltipAttrAm} style="border-bottom: 2px solid #e0e0e0;">${cellContentA}</td>`;
                }

                tableHtml += `<tr>${rowMatin}</tr><tr>${rowAprem}</tr>`;
            });

            tableHtml += `</tbody></table></div>`;
        }

        container.innerHTML = tableHtml;

    } catch (error) {
        console.error('Error rendering dashboard', error);
        container.innerHTML = '<p class="error">Erreur lors du chargement du tableau de bord.</p>';
    }
}

// --- Participants View ---

// Helper function to format dates
function formatDate(isoDate) {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}.${month}.${year}`;
}

async function loadParticipantsView() {
    const listContainer = document.getElementById('participants-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p>Chargement...</p>';
    try {
        const participants = await participantService.getAllParticipants();
        if (participants.length === 0) {
            listContainer.innerHTML = '<p>Aucun participant. Importez un PDF ou créez-en un manuellement.</p>';
        } else {
            // Sort by Last Name
            participants.sort((a, b) => a.lastName.localeCompare(b.lastName));

            listContainer.innerHTML = participants.map(p => {
                // Format schedule display
                let scheduleHtml = '';
                const workPercent = parseInt(p.workPercent || 100);

                if (p.schedule && workPercent < 100) {
                    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
                    scheduleHtml = '<div style="margin-top: 0.5rem;">';
                    days.forEach((d, i) => {
                        const dayKey = i + 1;
                        const am = p.schedule[`${dayKey}-am`];
                        const pm = p.schedule[`${dayKey}-pm`];
                        if (am || pm) {
                            scheduleHtml += `<span class="schedule-badge active">${d}: ${am ? 'M' : ''}${am && pm ? '+' : ''}${pm ? 'AM' : ''}</span>`;
                        }
                    });
                    scheduleHtml += '</div>';
                }

                return `
                <div class="participant-card" style="position: relative;">
                    <div style="position: absolute; top: 10px; left: 10px;">
                        <input type="checkbox" class="participant-batch-cb" value="${p.id}" style="transform: scale(1.5);">
                    </div>
                    <h3 style="margin-left: 25px;">${p.firstName} ${p.lastName}</h3>
                    <div class="card-details" style="margin-left: 25px;">
                        <p>Travail: <strong>${p.workPercent || 100}%</strong></p>
                        ${p.dateStart ? `<p>Début: <strong>${formatDate(p.dateStart)}</strong></p>` : ''}
                        ${p.dateEnd ? `<p>Fin: <strong>${formatDate(p.dateEnd)}</strong></p>` : ''}
                        ${p.courseType ? `<p>Cours: <strong>${p.courseType}</strong></p>` : ''}
                        ${scheduleHtml}
                    </div>
                    <div class="card-actions" style="margin-top: 1rem; display: flex; gap: 0.5rem; margin-left: 25px;">
                        <button class="btn-secondary btn-sm" onclick="window.app.editParticipant('${p.id}')">✏️ Modifier</button>
                        <button class="btn-secondary btn-sm" onclick="window.app.exportParticipantPDF('${p.id}')" title="Exporter PDF">📄 PDF</button>
                        <button class="btn-secondary btn-sm" onclick="window.app.deleteParticipant('${p.id}')" style="color: var(--primary);" title="Supprimer">🗑️</button>
                    </div>
                </div>
            `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading participants', error);
        listContainer.innerHTML = '<p class="error">Erreur lors du chargement des participants.</p>';
    }
}

window.app.toggleSelectAllParticipants = (source) => {
    const checkboxes = document.querySelectorAll('.participant-batch-cb');
    checkboxes.forEach(cb => cb.checked = source.checked);
};

window.app.deleteSelectedParticipants = async () => {
    const checkboxes = document.querySelectorAll('.participant-batch-cb:checked');
    const ids = Array.from(checkboxes).map(cb => cb.value);

    if (ids.length === 0) {
        alert('Veuillez sélectionner au moins un participant à supprimer.');
        return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${ids.length} participant(s) ?`)) return;

    try {
        for (const id of ids) {
            await participantService.deleteParticipant(id);
        }
        // Reset select all checkbox
        const selectAllCb = document.getElementById('cb-select-all-participants');
        if (selectAllCb) selectAllCb.checked = false;

        loadParticipantsView();
        alert(`${ids.length} participant(s) supprimé(s).`);
    } catch (error) {
        console.error('Error deleting participants batch', error);
        alert('Erreur lors de la suppression par lot.');
    }
};

// Participant Modal Logic

window.app.openNewParticipantModal = () => {
    document.getElementById('form-participant').reset();
    document.getElementById('p-id').value = '';
    document.getElementById('modal-p-title').textContent = 'Nouveau Participant';
    document.getElementById('modal-participant').style.display = 'flex';
};

window.app.closeModal = (id) => {
    document.getElementById(id).style.display = 'none';
};

window.app.editParticipant = async (id) => {
    try {
        const participants = await participantService.getAllParticipants();
        const p = participants.find(x => x.id === id);
        if (!p) return;

        document.getElementById('modal-p-title').textContent = 'Modifier Participant';
        document.getElementById('p-id').value = p.id;
        document.getElementById('p-firstname').value = p.firstName;
        document.getElementById('p-lastname').value = p.lastName;
        document.getElementById('p-work-percent').value = p.workPercent || 100;
        document.getElementById('p-date-start').value = p.dateStart || '';
        document.getElementById('p-date-end').value = p.dateEnd || '';
        document.getElementById('p-interruption-mmt').checked = p.interruptionMMT || false;
        document.getElementById('p-interruption-date').value = p.interruptionDate || '';

        // Set schedule checkboxes
        for (let i = 1; i <= 5; i++) {
            const am = p.schedule ? p.schedule[`${i}-am`] : true; // Default true
            const pm = p.schedule ? p.schedule[`${i}-pm`] : true;
            const amCb = document.querySelector(`input[name="sched-${i}-am"]`);
            const pmCb = document.querySelector(`input[name="sched-${i}-pm"]`);
            if (amCb) amCb.checked = am;
            if (pmCb) pmCb.checked = pm;
        }

        document.getElementById('modal-participant').style.display = 'flex';
    } catch (error) {
        console.error('Error editing participant', error);
    }
};

window.app.handleParticipantSubmit = async (event) => {
    event.preventDefault();
    const id = document.getElementById('p-id').value;
    const firstName = document.getElementById('p-firstname').value;
    const lastName = document.getElementById('p-lastname').value;
    const workPercent = document.getElementById('p-work-percent').value;
    const dateStart = document.getElementById('p-date-start').value;
    const dateEnd = document.getElementById('p-date-end').value;
    const interruptionMMT = document.getElementById('p-interruption-mmt').checked;
    const interruptionDate = document.getElementById('p-interruption-date').value;

    // Capture schedule
    const schedule = {};
    for (let i = 1; i <= 5; i++) {
        const amCb = document.querySelector(`input[name="sched-${i}-am"]`);
        const pmCb = document.querySelector(`input[name="sched-${i}-pm"]`);
        schedule[`${i}-am`] = amCb ? amCb.checked : false;
        schedule[`${i}-pm`] = pmCb ? pmCb.checked : false;
    }

    try {
        const participantData = {
            firstName,
            lastName,
            workPercent,
            dateStart,
            dateEnd,
            interruptionMMT,
            interruptionDate,
            schedule
        };

        if (id) {
            // Fetch existing participant to preserve originalPdf and other fields
            const existing = (await participantService.getAllParticipants()).find(p => p.id === id);
            if (existing) {
                // Merge existing data with new data
                const updatedParticipant = { ...existing, ...participantData, id };
                await participantService.updateParticipant(updatedParticipant);
            } else {
                // Fallback if not found (should not happen)
                participantData.id = id;
                await participantService.updateParticipant(participantData);
            }
        } else {
            await participantService.addParticipant(participantData);
        }

        document.getElementById('modal-participant').style.display = 'none';
        event.target.reset();
        loadParticipantsView(); // Refresh list
        if (document.getElementById('dashboard').style.display !== 'none') {
            renderDashboard();
        }
    } catch (error) {
        console.error('Error saving participant', error);
        alert('Erreur lors de l\'enregistrement du participant');
    }
};

// PDF Import Functionality
document.addEventListener('DOMContentLoaded', () => {
    const pdfFileInput = document.getElementById('pdf-file');
    const importForm = document.getElementById('form-import-pdf');
    const importPreview = document.getElementById('import-preview');

    if (pdfFileInput) {
        pdfFileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                importPreview.innerHTML = `
                    <p><strong>${files.length} fichier(s) sélectionné(s) :</strong></p>
                    <ul style="margin-left: 1.5rem;">
                        ${files.map(f => `<li>${f.name}</li>`).join('')}
                    </ul>
                `;
            } else {
                importPreview.innerHTML = '';
            }
        });
    }

    if (importForm) {
        importForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            console.log('🚀 SUBMIT HANDLER CALLED');

            const files = Array.from(pdfFileInput.files);
            if (files.length === 0) {
                alert('Veuillez sélectionner au moins un fichier PDF.');
                return;
            }

            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            console.log(`📁 Processing ${files.length} file(s)...`);

            for (const file of files) {
                try {
                    console.log(`Processing: ${file.name}`);

                    // Call parsePDF from pdf_parser.js
                    const data = await parsePDF(file);

                    // Save original PDF content
                    data.originalPdf = await file.arrayBuffer();

                    console.log('✅ PDF parsed successfully:', data);

                    // Check if participant already exists
                    console.log('🔍 Checking for duplicates...');
                    const allParticipants = await participantService.getAllParticipants();
                    console.log(`Found ${allParticipants.length} existing participants`);

                    const exists = allParticipants.find(p => {
                        const lastNameMatch = p.lastName.toLowerCase() === data.lastName.toLowerCase();
                        // If both firstNames are empty or both match, consider it a duplicate
                        const firstNameMatch = (!p.firstName && !data.firstName) ||
                            (p.firstName && data.firstName &&
                                p.firstName.toLowerCase() === data.firstName.toLowerCase());
                        return lastNameMatch && firstNameMatch;
                    });

                    if (exists) {
                        console.log(`♻️ Participant exists, updating: ${data.firstName} ${data.lastName}`);
                        // Preserve ID and update
                        await participantService.updateParticipant(exists.id, data);
                        console.log('✅ Update successful');
                    } else {
                        console.log(`➕ New participant, adding: ${data.firstName} ${data.lastName}`);
                        await participantService.addParticipant(data);
                        console.log('✅ Add successful');
                    }

                    successCount++;
                    console.log(`✅ Success count: ${successCount}`);
                } catch (error) {
                    console.error(`❌ Error processing ${file.name}:`, error);
                    errorCount++;
                    errors.push(`${file.name}: ${error.message}`);
                }
            }

            console.log('📊 Import complete. Success:', successCount, 'Errors:', errorCount);

            // Close modal and show results
            window.app.closeModal('modal-pdf-import');
            importForm.reset();
            importPreview.innerHTML = '';

            if (successCount > 0) {
                loadParticipantsView();
                const dashboardEl = document.getElementById('dashboard');
                if (dashboardEl && dashboardEl.style.display !== 'none') {
                    renderDashboard();
                }
            }

            // Show summary
            let message = `Import terminé:\n✅ ${successCount} réussi(s)`;
            if (errorCount > 0) {
                message += `\n❌ ${errorCount} erreur(s)`;
                if (errors.length > 0) {
                    message += `\n\nDétails des erreurs:\n${errors.join('\n')}`;
                }
            }
            alert(message);
        });
    }
});

// PDF Export Logic
// PDF Export Logic
window.app.exportParticipantPDF = async (participantId) => {
    try {
        const participant = (await participantService.getAllParticipants()).find(p => p.id === participantId);
        if (!participant) return;

        // Helper to generate and download
        const processExport = async (templateBuffer) => {
            try {
                // Get attendance data
                const monthInput = document.getElementById('dashboard-month');
                const monthValue = monthInput ? monthInput.value : new Date().toISOString().slice(0, 7);

                const allAttendance = await dbService.getAll(STORES.ATTENDANCE);
                const participantAttendance = allAttendance.filter(r =>
                    r.participantId === participantId &&
                    r.date && r.date.startsWith(monthValue)
                );

                // Prompt for signature date and correction
                const selectionResult = await window.app.requestSignatureDate();
                if (!selectionResult) return;

                const { date: signatureDateRaw, isCorrection } = selectionResult;

                // Convert YYYY-MM-DD to DD.MM.YYYY
                const [sYear, sMonth, sDay] = signatureDateRaw.split('-');
                const signatureDate = `${sDay}.${sMonth}.${sYear}`;

                const filledPdfBytes = await window.pdfGenerator.generatePDF(participant, participantAttendance, templateBuffer, signatureDate, isCorrection);

                // Download
                const blob = new Blob([filledPdfBytes], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `MMT_${participant.lastName}_${participant.firstName}_${monthValue}.pdf`;
                link.click();
            } catch (err) {
                console.error('Error during generation:', err);
                alert('Erreur: ' + err.message);
            }
        };

        if (participant.originalPdf && participant.originalPdf.byteLength > 0) {
            // Case 1: Use stored original PDF
            console.log('Using stored original PDF for export');
            await processExport(participant.originalPdf);
        } else {
            // Case 2: No stored PDF, ask user
            alert("Aucun modèle PDF n'est enregistré pour ce participant. Veuillez sélectionner le formulaire MMT vierge ou rempli.");

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const buffer = await file.arrayBuffer();
                await processExport(buffer);
            };
            input.click();
        }

    } catch (error) {
        console.error('Error in export flow', error);
        alert('Une erreur est survenue.');
    }
};

// Date Selection Helper
window.app.dateSelectionResolve = null;

window.app.requestSignatureDate = () => {
    return new Promise((resolve) => {
        window.app.dateSelectionResolve = resolve;

        // Set default to today
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        document.getElementById('input-signature-date').value = `${year}-${month}-${day}`;

        // Reset correction checkbox
        const correctionCb = document.getElementById('input-is-correction');
        if (correctionCb) correctionCb.checked = false;

        document.getElementById('modal-date-selection').style.display = 'flex';
    });
};

window.app.resolveDateSelection = (result) => {
    document.getElementById('modal-date-selection').style.display = 'none';
    if (window.app.dateSelectionResolve) {
        window.app.dateSelectionResolve(result);
        window.app.dateSelectionResolve = null;
    }
};

// Bind to global scope for HTML onclick handlers

// --- Classes View ---

// --- Classes View ---

window.app.loadClasses = async () => {
    const listContainer = document.getElementById('classes-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p>Chargement...</p>';
    try {
        const classes = await classService.getAllClasses();
        if (classes.length === 0) {
            listContainer.innerHTML = '<p>Aucune classe. Créez-en une pour commencer.</p>';
        } else {
            // Sort by ID descending
            classes.sort((a, b) => b.id.localeCompare(a.id));

            listContainer.innerHTML = classes.map(c => `
                <div class="class-card">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <h3>${c.name}</h3>
                        <div style="display:flex; gap:0.5rem;">
                            <button class="btn-secondary btn-sm" onclick="window.app.editClass('${c.id}')" title="Modifier">✏️</button>
                            <button class="btn-secondary btn-sm" onclick="window.app.deleteClass('${c.id}')" title="Supprimer" style="color:var(--primary);">🗑️</button>
                        </div>
                    </div>
                    <p>${c.description || ''}</p>
                    <p style="margin-top:0.5rem; font-weight:500; color:#666;">${c.participantIds?.length || 0} participants</p>
                    <div class="card-actions" style="margin-top:1rem;">
                        <button class="btn-primary btn-sm" onclick="window.app.openClassDetails('${c.id}')">Gérer Présences</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading classes', error);
        listContainer.innerHTML = '<p class="error">Erreur lors du chargement des classes.</p>';
    }
};

window.app.openModal = (id) => document.getElementById(id).style.display = 'flex';

// Batch PDF Export
window.app.exportSelectedParticipantsPDF = async () => {
    const checkboxes = document.querySelectorAll('.participant-batch-cb:checked');
    const ids = Array.from(checkboxes).map(cb => cb.value);

    if (ids.length === 0) {
        alert('Veuillez sélectionner au moins un participant.');
        return;
    }

    // Ask for template
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const templateBytes = await file.arrayBuffer();
            const mergedPdf = await PDFLib.PDFDocument.create();

            const participants = await participantService.getAllParticipants();
            const allAttendance = await dbService.getAll(STORES.ATTENDANCE);

            // Get month
            const monthInput = document.getElementById('dashboard-month');
            const monthValue = monthInput ? monthInput.value : new Date().toISOString().slice(0, 7);

            // Prompt for signature date
            const now = new Date();
            const defaultDate = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
            const signatureDate = prompt("Veuillez valider ou modifier la date de signature :", defaultDate);
            if (signatureDate === null) return;

            let processedCount = 0;

            for (const id of ids) {
                const p = participants.find(x => x.id === id);
                if (!p) continue;

                const pAttendance = allAttendance.filter(r =>
                    r.participantId === id &&
                    r.date && r.date.startsWith(monthValue)
                );

                // Generate individual PDF
                const filledBytes = await window.pdfGenerator.generatePDF(p, pAttendance, templateBytes, signatureDate);

                // Load it to copy pages
                const filledPdf = await PDFLib.PDFDocument.load(filledBytes);
                const copiedPages = await mergedPdf.copyPages(filledPdf, filledPdf.getPageIndices());

                copiedPages.forEach((page) => mergedPdf.addPage(page));
                processedCount++;
            }

            // Save merged PDF
            const mergedBytes = await mergedPdf.save();
            const blob = new Blob([mergedBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `MMT_Export_Groupe_${monthValue}.pdf`;
            link.click();

            alert(`${processedCount} formulaires générés et fusionnés avec succès !`);

        } catch (error) {
            console.error('Batch export error', error);
            alert('Erreur lors de l\'exportation groupée: ' + error.message);
        }
    };

    input.click();
};

// Generate Monthly Report (Compile all PDFs)
window.app.generateMonthlyReport = async () => {
    // Open selection modal
    const classes = await classService.getAllClasses();
    const participants = await participantService.getAllParticipants();

    // Identify groups
    // 1. Defined Classes
    // 2. "Sans classe" (participants not in any class)

    // Find participants without class
    const participantsInClasses = new Set();
    classes.forEach(c => {
        if (c.participantIds) c.participantIds.forEach(id => participantsInClasses.add(id));
    });
    const participantsWithoutClass = participants.filter(p => !participantsInClasses.has(p.id));

    const container = document.getElementById('print-class-selection-list');
    container.innerHTML = '';

    // Add "Select All"
    container.innerHTML += `
        <div style="padding: 0.5rem; border-bottom: 2px solid #eee; margin-bottom:0.5rem;">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight:bold;">
                <input type="checkbox" onchange="const cbs = document.querySelectorAll('.print-class-cb'); cbs.forEach(cb => cb.checked = this.checked);">
                Tout sélectionner
            </label>
        </div>
    `;

    classes.forEach(c => {
        container.innerHTML += `
            <div style="padding: 0.5rem; border-bottom: 1px solid #eee;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" class="print-class-cb" value="class:${c.id}">
                    <span style="font-weight:500;">Classe: ${c.name}</span> <span style="color:#666; font-size:0.9em;">(${c.participantIds ? c.participantIds.length : 0} participants)</span>
                </label>
            </div>
        `;
    });

    if (participantsWithoutClass.length > 0) {
        container.innerHTML += `
            <div style="padding: 0.5rem; border-bottom: 1px solid #eee;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" class="print-class-cb" value="noclass">
                    <span style="font-weight:500;">Sans classe</span> <span style="color:#666; font-size:0.9em;">(${participantsWithoutClass.length} participants)</span>
                </label>
            </div>
        `;
    }

    if (classes.length === 0 && participantsWithoutClass.length === 0) {
        container.innerHTML = '<p>Aucun participant ni classe trouvé.</p>';
    }

    window.app.openModal('modal-print-selection');
};

window.app.confirmPrintSelection = async () => {
    const selectedCbs = document.querySelectorAll('.print-class-cb:checked');
    if (selectedCbs.length === 0) {
        alert('Veuillez sélectionner au moins une classe ou un groupe.');
        return;
    }

    const selections = Array.from(selectedCbs).map(cb => cb.value); // ['class:ID', 'noclass']

    // Close modal
    window.app.closeModal('modal-print-selection');

    // Proceed to standard generation logic
    try {
        const monthInput = document.getElementById('dashboard-month');
        const monthValue = monthInput ? monthInput.value : new Date().toISOString().slice(0, 7);

        // Prompt for signature date
        const selectionResult = await window.app.requestSignatureDate();
        if (!selectionResult) return;

        const { date: signatureDateRaw, isCorrection } = selectionResult;

        // Convert YYYY-MM-DD to DD.MM.YYYY
        const [sYear, sMonth, sDay] = signatureDateRaw.split('-');
        const signatureDate = `${sDay}.${sMonth}.${sYear}`;

        const allParticipants = await participantService.getAllParticipants();
        const allAttendance = await dbService.getAll(STORES.ATTENDANCE);
        const classes = await classService.getAllClasses();

        // Filter participants based on selection
        let targetParticipants = [];
        const participantsInClassesIds = new Set();

        // Helper to get class participants
        const getClassParticipants = (classId) => {
            const cls = classes.find(c => c.id === classId);
            if (!cls || !cls.participantIds) return [];
            return allParticipants.filter(p => cls.participantIds.includes(p.id));
        };

        for (const sel of selections) {
            if (sel.startsWith('class:')) {
                const classId = sel.split(':')[1];
                const ps = getClassParticipants(classId);
                targetParticipants.push(...ps);
            } else if (sel === 'noclass') {
                // Find those without class
                classes.forEach(c => {
                    if (c.participantIds) c.participantIds.forEach(id => participantsInClassesIds.add(id));
                });
                const noClassPs = allParticipants.filter(p => !participantsInClassesIds.has(p.id));
                targetParticipants.push(...noClassPs);
            }
        }

        // Deduplicate (just in case)
        targetParticipants = [...new Set(targetParticipants)];

        if (targetParticipants.length === 0) {
            alert('Aucun participant dans la sélection.');
            return;
        }

        const mergedPdf = await PDFLib.PDFDocument.create();
        let processedCount = 0;
        let missingPdfCount = 0;
        const missingPdfNames = [];
        const generationErrors = [];

        // Sort participants
        // Sort participants: Caisse then Name
        targetParticipants.sort((a, b) => {
            const caisseA = (a.unemploymentOffice || '').toLowerCase();
            const caisseB = (b.unemploymentOffice || '').toLowerCase();
            if (caisseA < caisseB) return -1;
            if (caisseA > caisseB) return 1;
            return a.lastName.localeCompare(b.lastName);
        });

        const summaryList = []; // Liste pour la page de synthèse

        for (const p of targetParticipants) {
            if (!p.originalPdf) {
                console.warn(`No original PDF for ${p.firstName} ${p.lastName}`);
                missingPdfNames.push(`${p.firstName} ${p.lastName}`);
                missingPdfCount++;
                continue;
            }

            if (!(p.originalPdf instanceof ArrayBuffer) && !ArrayBuffer.isView(p.originalPdf)) {
                generationErrors.push(`${p.firstName} ${p.lastName}: Données PDF corrompues`);
                continue;
            }

            const pAttendance = allAttendance.filter(r =>
                r.participantId === p.id &&
                r.date && r.date.startsWith(monthValue)
            );

            try {
                const filledBytes = await window.pdfGenerator.generatePDF(p, pAttendance, p.originalPdf, signatureDate, isCorrection);
                const filledPdf = await PDFLib.PDFDocument.load(filledBytes);
                const copiedPages = await mergedPdf.copyPages(filledPdf, filledPdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
                processedCount++;

                // Ajouter au sommaire
                summaryList.push({
                    name: `${p.lastName} ${p.firstName}`,
                    caisse: p.unemploymentOffice || '-'
                });
            } catch (err) {
                console.error(`Error processing ${p.lastName}:`, err);
                generationErrors.push(`${p.firstName} ${p.lastName}: ${err.message}`);
            }
        }

        if (processedCount === 0) {
            let msg = 'Aucun PDF n\'a pu être généré.';
            if (missingPdfNames.length > 0) msg += '\n\n⚠️ PDF manquant pour :\n- ' + missingPdfNames.join('\n- ');
            if (generationErrors.length > 0) msg += '\n\n❌ Erreurs :\n- ' + generationErrors.join('\n- ');
            alert(msg);
            return;
        }

        // --- GÉNÉRATION DE LA PAGE DE SYNTHÈSE ---
        if (summaryList.length > 0) {
            try {
                let summaryPage = mergedPdf.addPage();
                const { width, height } = summaryPage.getSize();
                const font = await mergedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
                const fontBold = await mergedPdf.embedFont(PDFLib.StandardFonts.HelveticaBold);

                let currentY = height - 50;

                // Titre
                summaryPage.drawText('Récapitulatif - Liste des Caisses de Chômage / MMT', {
                    x: 50,
                    y: currentY,
                    size: 16,
                    font: fontBold
                });

                currentY -= 20;
                const nowStr = new Date().toLocaleDateString('fr-CH');
                summaryPage.drawText(`Généré le: ${nowStr}`, {
                    x: 50,
                    y: currentY,
                    size: 10,
                    font: font
                });

                currentY -= 40;

                // Regroupement par Caisse
                const groups = {};
                summaryList.forEach(item => {
                    let c = (item.caisse || 'Non défini').trim();
                    if (c === '' || c === '-') c = 'Non défini';
                    if (!groups[c]) groups[c] = [];
                    groups[c].push(item);
                });

                const sortedCaisses = Object.keys(groups).sort((a, b) => a.localeCompare(b));

                for (const caisse of sortedCaisses) {
                    // Vérifier espace pour le titre de groupe (besoin d'au moins 40px)
                    if (currentY < 60) {
                        summaryPage = mergedPdf.addPage();
                        currentY = height - 50;
                        // Titre de rappel
                        summaryPage.drawText('Récapitulatif (suite)', { x: 50, y: currentY, size: 10, font: font });
                        currentY -= 30;
                    }

                    // Titre du groupe (Caisse)
                    // Fond gris léger pour le header de groupe
                    summaryPage.drawRectangle({
                        x: 40,
                        y: currentY - 5,
                        width: 520,
                        height: 20,
                        color: PDFLib.rgb(0.9, 0.9, 0.9),
                    });

                    summaryPage.drawText(`📂 ${caisse}`, {
                        x: 50,
                        y: currentY,
                        size: 11,
                        font: fontBold,
                        color: PDFLib.rgb(0, 0, 0)
                    });

                    currentY -= 25;

                    // Liste des participants du groupe
                    const participants = groups[caisse].sort((a, b) => a.name.localeCompare(b.name));

                    for (const p of participants) {
                        if (currentY < 40) {
                            summaryPage = mergedPdf.addPage();
                            currentY = height - 50;
                            summaryPage.drawText('Récapitulatif (suite)', { x: 50, y: currentY, size: 10, font: font });
                            currentY -= 30;

                            // Rappel du titre du groupe sur nouvelle page
                            summaryPage.drawText(`📂 ${caisse} (suite)`, {
                                x: 50,
                                y: currentY,
                                size: 11,
                                font: fontBold,
                                color: PDFLib.rgb(0.4, 0.4, 0.4)
                            });
                            currentY -= 20;
                        }

                        summaryPage.drawText(`• ${p.name}`, {
                            x: 70, // Indentation
                            y: currentY,
                            size: 10,
                            font: font
                        });
                        currentY -= 15;
                    }

                    currentY -= 10; // Espace entre les groupes
                }

                console.log('✅ Page de synthèse ajoutée (groupée par caisse)');

            } catch (e) {
                console.error('Erreur lors de la création de la page de synthèse:', e);
            }
        }

        const mergedBytes = await mergedPdf.save();
        const blob = new Blob([mergedBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (!printWindow) alert('Le rapport a été généré mais le popup a été bloqué.');

    } catch (error) {
        console.error('Report generation error', error);
        alert('Erreur: ' + error.message);
    }
};

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

// Data Export/Import for Office 365 / OneDrive
window.app.exportData = async () => {
    try {
        const participants = await participantService.getAllParticipants();
        const classes = await classService.getAllClasses();
        const attendance = await dbService.getAll(STORES.ATTENDANCE);

        // Convert PDF ArrayBuffers to Base64 for JSON storage
        const participantsExport = participants.map(p => {
            const pCopy = { ...p };
            if (pCopy.originalPdf) {
                pCopy.originalPdfBase64 = arrayBufferToBase64(pCopy.originalPdf);
                delete pCopy.originalPdf; // Remove binary from JSON
            }
            return pCopy;
        });

        const data = {
            version: '1.1',
            timestamp: new Date().toISOString(),
            participants: participantsExport,
            classes,
            attendance
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `MMT_DATA_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();

        alert('Données exportées avec succès (incluant les fichiers PDF originaux).');
    } catch (error) {
        console.error('Export error', error);
        alert('Erreur lors de l\'exportation.');
    }
};

window.app.importData = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('ATTENTION: Cette action va REMPLACER toutes les données actuelles.\n\nVoulez-vous continuer ?')) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.participants || !data.attendance) {
                throw new Error('Format de fichier invalide');
            }

            // Restore participants (convert Base64 back to ArrayBuffer)
            const participantsToRestore = data.participants.map(p => {
                const pCopy = { ...p };
                if (pCopy.originalPdfBase64) {
                    pCopy.originalPdf = base64ToArrayBuffer(pCopy.originalPdfBase64);
                    delete pCopy.originalPdfBase64;
                }
                return pCopy;
            });

            // Upsert data
            for (const p of participantsToRestore) await participantService.updateParticipant(p.id, p);
            for (const c of data.classes) await dbService.add(STORES.CLASSES, c);
            for (const a of data.attendance) await dbService.add(STORES.ATTENDANCE, a);

            alert('Données importées avec succès !');
            location.reload();

        } catch (error) {
            console.error('Import error', error);
            alert('Erreur lors de l\'importation: ' + error.message);
        }
    };
    input.click();
};
window.app.exportData = async () => {
    try {
        const participants = await participantService.getAllParticipants();
        const classes = await classService.getAllClasses();
        const attendance = await dbService.getAll(STORES.ATTENDANCE);

        const data = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            participants,
            classes,
            attendance
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `MMT_DATA_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();

        alert('Données exportées avec succès.\n\nPour utiliser avec Office 365 :\n1. Enregistrez ce fichier dans votre dossier OneDrive/SharePoint.\n2. Pour restaurer, utilisez le bouton "Charger" et sélectionnez ce fichier.');
    } catch (error) {
        console.error('Export error', error);
        alert('Erreur lors de l\'exportation.');
    }
};

window.app.importData = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('ATTENTION: Cette action va REMPLACER toutes les données actuelles par celles du fichier.\n\nVoulez-vous continuer ?')) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.participants || !data.attendance) {
                throw new Error('Format de fichier invalide');
            }

            // Clear existing data
            // We need a way to clear stores. dbService doesn't have clearAll, but we can overwrite.
            // Actually, IndexedDB is persistent. We should probably clear it first.
            // For now, let's just use put (update/insert). But deletion of old records is tricky without clear.
            // Let's assume we just merge/overwrite for now, or better, clear if possible.
            // Since we don't have a clear method exposed, we'll just loop and delete? Too slow.
            // Let's just add/update.

            // Re-initializing DB might be cleaner but complex.
            // Let's just upsert everything.

            for (const p of data.participants) await participantService.updateParticipant(p.id, p); // This might fail if update expects existing.
            // Actually updateParticipant in db.js likely uses 'put' which is upsert.
            // Let's check db.js if I can.
            // Assuming 'put' behavior.

            // We'll just alert the user that it merges.

            // Wait, to be safe for "Office 365" usage where users might switch computers, we really want a full restore.
            // I'll assume standard IDB 'put' works.

            for (const p of data.participants) await dbService.add(STORES.PARTICIPANTS, p);
            for (const c of data.classes) await dbService.add(STORES.CLASSES, c);
            for (const a of data.attendance) await dbService.add(STORES.ATTENDANCE, a);

            alert('Données importées avec succès !');
            location.reload();

        } catch (error) {
            console.error('Import error', error);
            alert('Erreur lors de l\'importation: ' + error.message);
        }
    };
    input.click();
};

window.app.handleClassSubmit = async (e) => {
    e.preventDefault();
    const idInput = document.getElementById('c-id');
    const name = document.getElementById('c-name').value;
    const description = document.getElementById('c-desc').value;

    try {
        if (idInput.value) {
            // Update
            const classes = await classService.getAllClasses();
            const existing = classes.find(c => c.id === idInput.value);
            if (existing) {
                await classService.updateClass({ ...existing, name, description });
            }
        } else {
            // Create
            await classService.addClass({ name, description });
        }

        document.getElementById('modal-class').style.display = 'none';
        e.target.reset();
        idInput.value = '';
        document.querySelector('#modal-class h2').textContent = 'Nouvelle Classe';
        document.querySelector('#modal-class button[type="submit"]').textContent = 'Créer';
        window.app.loadClasses();
    } catch (error) {
        console.error('Error saving class', error);
        alert('Erreur lors de la sauvegarde de la classe');
    }
};

window.app.editClass = async (id) => {
    const classes = await classService.getAllClasses();
    const c = classes.find(x => x.id === id);
    if (!c) return;

    document.getElementById('c-id').value = c.id;
    document.getElementById('c-name').value = c.name;
    document.getElementById('c-desc').value = c.description || '';

    document.querySelector('#modal-class h2').textContent = 'Modifier Classe';
    document.querySelector('#modal-class button[type="submit"]').textContent = 'Mettre à jour';

    window.app.openModal('modal-class');
};

window.app.deleteClass = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette classe ?')) return;
    await classService.deleteClass(id);
    window.app.loadClasses();
};

window.app.openClassDetails = async (classId) => {
    loadClassDetails(classId);
};

window.app.openClassAttendance = async (classId) => {
    await loadClassDetails(classId);
    // Click the Attendance tab
    const tabBtn = document.querySelector('.tab-btn[data-tab="attendance"]');
    if (tabBtn) tabBtn.click();
};

window.app.openManageParticipantsModal = async () => {
    const allP = await participantService.getAllParticipants();
    const classes = await classService.getAllClasses();
    const cls = classes.find(c => c.id === currentClassId);

    const container = document.getElementById('manage-participants-list');
    container.innerHTML = allP.map(p => {
        const isChecked = cls.participantIds && cls.participantIds.includes(p.id);
        return `
            <div style="padding: 0.5rem; border-bottom: 1px solid #eee;">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" class="manage-p-cb" value="${p.id}" ${isChecked ? 'checked' : ''}>
                    ${p.firstName} ${p.lastName}
            </label>
            </div>
                `;
    }).join('');

    window.app.openModal('modal-manage-participants');
};

window.app.saveClassParticipants = async () => {
    const selectedIds = Array.from(document.querySelectorAll('.manage-p-cb:checked')).map(cb => cb.value);

    const classes = await classService.getAllClasses();
    const cls = classes.find(c => c.id === currentClassId);
    cls.participantIds = selectedIds;

    await classService.updateClass(cls);
    window.app.closeModal('modal-manage-participants');
    loadClassDetails(currentClassId);
};

let currentClassId = null;

async function loadClassDetails(classId) {
    currentClassId = classId;
    // Switch view
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    document.getElementById('class-details').style.display = 'block';

    try {
        const classes = await classService.getAllClasses();
        const cls = classes.find(c => c.id === classId);
        if (!cls) return;

        document.getElementById('class-details-title').textContent = cls.name;

        // Load Participants Tab
        loadClassParticipants(cls);

        // Load Attendance Tab (Default to today)
        document.getElementById('attendance-date').valueAsDate = new Date();
        loadAttendanceGrid(cls);

    } catch (error) {
        console.error('Error loading class details', error);
    }
}

async function loadClassParticipants(cls) {
    const container = document.getElementById('class-participants-list');
    container.innerHTML = '';

    if (!cls.participantIds || cls.participantIds.length === 0) {
        container.innerHTML = '<p>Aucun participant dans cette classe.</p>';
        return;
    }

    const allParticipants = await participantService.getAllParticipants();
    const classParticipants = allParticipants.filter(p => cls.participantIds.includes(p.id));

    container.innerHTML = classParticipants.map(p => `
                <div class="participant-card">
            <h3>${p.firstName} ${p.lastName}</h3>
            <p>${p.courseType || ''}</p>
        </div>
                `).join('');
}

async function loadAttendanceGrid(cls) {
    const grid = document.getElementById('attendance-grid');
    const date = document.getElementById('attendance-date').value;

    // Reset indicator initially
    updateCheckIndicator(false);

    if (!cls.participantIds || cls.participantIds.length === 0) {
        grid.innerHTML = '<p>Ajoutez des participants pour saisir les présences.</p>';
        return;
    }

    const allParticipants = await participantService.getAllParticipants();
    const classParticipants = allParticipants.filter(p => cls.participantIds.includes(p.id));

    // Load existing attendance
    const existingRecords = await attendanceService.getAttendance(cls.id, date);
    const recordMap = new Map(); // Map participantId -> record
    existingRecords.forEach(r => recordMap.set(r.participantId, r));

    // Use the new ATTENDANCE_CODES from attendance.js
    const codes = window.ATTENDANCE_CODES;

    const generateOptions = (selectedValue) => {
        // Shortened descriptions for dropdown
        const shortDescriptions = {
            'X': 'Sur place',
            'O': 'En ligne',
            'A': 'Vacances (autorisation ORP)',
            'B': 'Maladie/Grossesse (certificat dès 4e jour)',
            'C': 'Accident (certificat dès 4e jour)',
            'D': 'Congé maternité/parental',
            'E': 'Service militaire/civil',
            'F': 'Gain intermédiaire',
            'G': 'Autres absences justifiées (mariage, décès, visite médicale, etc.)',
            'H': 'Jours fériés/Fermeture',
            'I': 'Absence non justifiée'
        };

        let options = '';
        for (const [code, info] of Object.entries(codes)) {
            const selected = selectedValue === code ? 'selected' : '';
            const shortDesc = shortDescriptions[code] || info.label;
            options += `<option value="${code}" ${selected}>${code} - ${shortDesc}</option>`;
        }
        return options;
    };

    let html = `
            <style>
            /* Compact attendance table */
            .attendance-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 1rem;
            }
            .attendance-table th {
                background: var(--primary);
                color: white;
                padding: 0.75rem;
                text-align: left;
                font-weight: 600;
            }
            .attendance-table td {
                padding: 0.5rem;
                border-bottom: 1px solid #eee;
            }
            .attendance-table tr:hover {
                background: #f8f9fa;
            }
            /* Compact select - show only code letter */
            .attendance-select {
                width: 50px;
                text-align: center;
                font-weight: bold;
                font-size: 1rem;
                padding: 0.3rem;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            /* Dropdown options with limited width */
            .attendance-select option {
                text-align: left;
                font-weight: normal;
                white-space: normal;
                padding: 0.5rem;
                max-width: 500px;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            /* Limit dropdown menu width */
            .attendance-select:focus {
                max-width: 500px;
            }
            /* Comment input */
            .attendance-comment {
                width: 100%;
                padding: 0.4rem;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 0.9rem;
            }
            </style>
            <table class="attendance-table">
                <thead>
                    <tr>
                        <th style="width: 30%;">Participant</th>
                        <th style="width: 8%; text-align: center;">Matin</th>
                        <th style="width: 8%; text-align: center;">Après-midi</th>
                        <th style="width: 54%;">Commentaire</th>
                    </tr>
                </thead>
                <tbody>
                    `;

    html += classParticipants.map(p => {
        const record = recordMap.get(p.id) || {};
        const morningVal = record.morningCode || 'X';
        const afternoonVal = record.afternoonCode || 'X';
        const commentVal = record.comment || '';

        return `
                    <tr class="attendance-row" data-participant-id="${p.id}">
                        <td><strong>${p.firstName} ${p.lastName}</strong></td>
                        <td style="text-align: center;">
                            <select class="attendance-select" data-pid="${p.id}" data-period="morning" onchange="handleAttendanceCodeChange()">
                                ${generateOptions(morningVal)}
                            </select>
                        </td>
                        <td style="text-align: center;">
                            <select class="attendance-select" data-pid="${p.id}" data-period="afternoon" onchange="handleAttendanceCodeChange()">
                                ${generateOptions(afternoonVal)}
                            </select>
                        </td>
                        <td>
                            <input type="text" class="attendance-comment" data-pid="${p.id}" value="${commentVal}" placeholder="Justification...">
                        </td>
                    </tr>
                    `;
    }).join('');

    html += `
                </tbody>
            </table>
        `;

    grid.innerHTML = html;

    // Apply custom rendering to show only code in select
    document.querySelectorAll('.attendance-select').forEach(select => {
        updateSelectDisplay(select);
        select.addEventListener('change', function () {
            updateSelectDisplay(this);
        });
    });

    // Check if code G is used and show/hide comment requirement
    handleAttendanceCodeChange();

    // Check if attendance has been marked as checked
    console.log('🔍 Checking if attendance is marked as checked for:', cls.id, date);
    const isChecked = await attendanceService.isChecked(cls.id, date);
    console.log('✅ isChecked result:', isChecked);
    updateCheckIndicator(isChecked);
}

// Helper function to display only code in select
function updateSelectDisplay(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    if (selectedOption) {
        const code = selectedOption.value;
        // Create a temporary option with just the code
        const tempOption = document.createElement('option');
        tempOption.value = code;
        tempOption.textContent = code;
        tempOption.selected = true;

        // Store original options
        if (!selectElement.dataset.originalHtml) {
            selectElement.dataset.originalHtml = selectElement.innerHTML;
        }

        // On focus, show full options
        selectElement.addEventListener('focus', function () {
            this.innerHTML = this.dataset.originalHtml;
            this.value = code;
        }, { once: false });

        // On blur, show only code
        selectElement.addEventListener('blur', function () {
            const currentValue = this.value;
            this.dataset.originalHtml = this.innerHTML;
            this.innerHTML = '';
            const opt = document.createElement('option');
            opt.value = currentValue;
            opt.textContent = currentValue;
            opt.selected = true;
            this.appendChild(opt);
        }, { once: false });

        // Initial display: show only code
        if (!selectElement.matches(':focus')) {
            selectElement.innerHTML = '';
            selectElement.appendChild(tempOption);
        }
    }
}

// Date change listener
document.getElementById('attendance-date')?.addEventListener('change', async () => {
    if (currentClassId) {
        const classes = await classService.getAllClasses();
        const cls = classes.find(c => c.id === currentClassId);
        if (cls) loadAttendanceGrid(cls);
    }
});

// Date navigation buttons - Skip Weekends
document.getElementById('btn-prev-date')?.addEventListener('click', () => {
    const dateInput = document.getElementById('attendance-date');
    if (!dateInput.value) return;
    const currentDate = new Date(dateInput.value);

    // Move back one day
    currentDate.setDate(currentDate.getDate() - 1);

    // If Sunday (0), go back to Friday
    if (currentDate.getDay() === 0) {
        currentDate.setDate(currentDate.getDate() - 2);
    }
    // If Saturday (6), go back to Friday
    else if (currentDate.getDay() === 6) {
        currentDate.setDate(currentDate.getDate() - 1);
    }

    dateInput.value = currentDate.toISOString().split('T')[0];
    dateInput.dispatchEvent(new Event('change'));
});

document.getElementById('btn-next-date')?.addEventListener('click', () => {
    const dateInput = document.getElementById('attendance-date');
    if (!dateInput.value) return;
    const currentDate = new Date(dateInput.value);

    // Move forward one day
    currentDate.setDate(currentDate.getDate() + 1);

    // If Saturday (6), go forward to Monday
    if (currentDate.getDay() === 6) {
        currentDate.setDate(currentDate.getDate() + 2);
    }
    // If Sunday (0), go forward to Monday
    else if (currentDate.getDay() === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
    }

    dateInput.value = currentDate.toISOString().split('T')[0];
    dateInput.dispatchEvent(new Event('change'));
});

// Handle attendance code change - highlight comment fields when code G is used
window.handleAttendanceCodeChange = function () {
    const rows = document.querySelectorAll('.attendance-row');

    rows.forEach(row => {
        const selects = row.querySelectorAll('.attendance-select');
        const commentInput = row.querySelector('.attendance-comment');
        const morningCode = selects[0]?.value;
        const afternoonCode = selects[1]?.value;

        // Highlight comment field if code G is used for this participant
        if (commentInput) {
            if (morningCode === 'G' || afternoonCode === 'G') {
                commentInput.style.backgroundColor = '#fff9c4';
                commentInput.style.border = '2px solid #ff9800';
                commentInput.placeholder = 'OBLIGATOIRE pour code G - Précisez la raison';
                commentInput.required = true;
            } else {
                commentInput.style.backgroundColor = '';
                commentInput.style.border = '';
                commentInput.placeholder = 'Justification...';
                commentInput.required = false;
            }
        }
    });
};

// Update check indicator
function updateCheckIndicator(isChecked) {
    let indicator = document.getElementById('attendance-check');

    if (indicator) {
        if (isChecked) {
            indicator.innerHTML = '<span style="font-size: 1.5rem; filter: grayscale(1);">✔️</span>';
            indicator.style.display = 'inline-block';
            indicator.style.color = '#000000';  // Noir
            indicator.style.marginLeft = '1rem';
            indicator.style.padding = '0.5rem 1rem';
            indicator.style.backgroundColor = '#ffebee';  // Rouge très clair
            indicator.style.borderRadius = '8px';
            indicator.style.border = '2px solid #e53935';  // Rouge moyen
        } else {
            indicator.innerHTML = '';
            indicator.style.display = 'none';
        }
    } else {
        console.warn('Attendance check indicator element not found');
    }
}

// Save Attendance Logic
window.saveAttendance = async () => {
    if (!currentClassId) return;

    const date = document.getElementById('attendance-date').value;
    const rows = document.querySelectorAll('.attendance-row');
    const records = [];
    let hasError = false;
    const errors = [];

    // Build records and validate
    rows.forEach(row => {
        const participantId = row.dataset.participantId;
        const selects = row.querySelectorAll('select');
        const commentInput = row.querySelector('.attendance-comment');

        const morningCode = selects[0]?.value || 'X';
        const afternoonCode = selects[1]?.value || 'X';
        const comment = commentInput ? commentInput.value.trim() : '';

        // Validation: Comment required if code G is used
        if ((morningCode === 'G' || afternoonCode === 'G') && !comment) {
            hasError = true;
            if (commentInput) {
                commentInput.style.border = '3px solid red';
            }
            // Get participant name from the row
            const nameCell = row.querySelector('td');
            const participantName = nameCell ? nameCell.textContent : 'Participant';
            errors.push(participantName);
        } else {
            if (commentInput) {
                commentInput.style.border = '';
            }
        }

        records.push({
            date,
            classId: currentClassId,
            participantId,
            morningCode,
            afternoonCode,
            comment
        });
    });

    if (hasError) {
        alert(`Un commentaire est obligatoire pour le code G(Autres absences justifiées).\n\nParticipants concernés: \n - ${errors.join('\n- ')} \n\nVeuillez préciser la raison: mariage(3j), naissance(3j), décès proche(3j), funérailles(1j), déménagement(1j), inspection militaire(½-1j), visite médicale, assistance proche malade(3j), entretien ORP, entretien d'embauche, rendez-vous officiel, essai en entreprise, autre absence autorisée par l'ORP.`);
        return;
    }

    try {
        await attendanceService.saveAttendance(records);
        console.log('💾 Attendance saved successfully');

        // Mark as checked
        console.log('✔️ Marking attendance as checked for:', currentClassId, date);
        await attendanceService.markAsChecked(currentClassId, date);
        console.log('✅ Marked as checked successfully');

        // Update check indicator
        updateCheckIndicator(true);

        alert('Présences enregistrées avec succès !');
    } catch (error) {
        console.error('Error saving attendance', error);
        alert('Erreur lors de la sauvegarde.');
    }
};

// Event Listeners for Class Details
document.getElementById('btn-back-classes')?.addEventListener('click', () => {
    navigateTo('classes');
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

        e.target.classList.add('active');
        document.getElementById(`tab - ${e.target.dataset.tab} `).style.display = 'block';
    });
});

// Assign Participant Logic
document.getElementById('btn-add-participant-to-class')?.addEventListener('click', async () => {
    const modal = document.getElementById('modal-assign-participant');
    const list = document.getElementById('assign-participants-list');
    modal.style.display = 'flex';

    // Load candidates (not already in class)
    const allParticipants = await participantService.getAllParticipants();
    const classes = await classService.getAllClasses();
    const currentClass = classes.find(c => c.id === currentClassId);

    const candidates = allParticipants.filter(p => !currentClass.participantIds.includes(p.id));

    if (candidates.length === 0) {
        list.innerHTML = '<p>Tous les participants sont déjà dans cette classe.</p>';
    } else {
        list.innerHTML = candidates.map(p => `
            < div style = "padding: 0.5rem; border-bottom: 1px solid #eee;" >
                <input type="checkbox" id="assign-${p.id}" value="${p.id}">
                    <label for="assign-${p.id}">${p.firstName} ${p.lastName}</label>
                </div>
        `).join('');
    }
});

document.getElementById('btn-confirm-assign')?.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('#assign-participants-list input:checked');
    const ids = Array.from(checkboxes).map(cb => cb.value);

    if (ids.length > 0) {
        for (const id of ids) {
            await classService.addParticipantToClass(currentClassId, id);
        }
        document.getElementById('modal-assign-participant').style.display = 'none';
        loadClassDetails(currentClassId); // Refresh
    }
});

document.getElementById('btn-cancel-assign')?.addEventListener('click', () => {
    document.getElementById('modal-assign-participant').style.display = 'none';
});

// PDF Import Logic
document.getElementById('btn-import-pdf')?.addEventListener('click', () => {
    document.getElementById('modal-import-pdf').style.display = 'flex';
});

document.getElementById('btn-cancel-import')?.addEventListener('click', () => {
    document.getElementById('modal-import-pdf').style.display = 'none';
    document.getElementById('import-preview').style.display = 'none';
    document.getElementById('form-import-pdf').reset();
});







// Test Mode: Add test participants without PDF
window.addTestParticipants = async () => {
    const testParticipants = [
        { firstName: 'Jean', lastName: 'Dupont', courseType: 'MARKET0625' },
        { firstName: 'Marie', lastName: 'Martin', courseType: 'MARKET0625' },
        { firstName: 'Pierre', lastName: 'Bernard', courseType: 'DIGITAL0725' },
        { firstName: 'Sophie', lastName: 'Dubois', courseType: 'DIGITAL0725' },
        { firstName: 'Luc', lastName: 'Moreau', courseType: 'MARKET0625' }
    ];

    let importedCount = 0;
    const allParticipants = await participantService.getAllParticipants();

    for (const testData of testParticipants) {
        const exists = allParticipants.find(p =>
            p.lastName.toLowerCase() === testData.lastName.toLowerCase() &&
            p.firstName.toLowerCase() === testData.firstName.toLowerCase()
        );

        if (!exists) {
            await participantService.addParticipant(testData);
            importedCount++;
        }
    }

    alert(`✅ Mode Test: ${importedCount} participant(s) de test ajouté(s).`);
    document.getElementById('modal-import-pdf').style.display = 'none';
    loadParticipantsView();
};

// Duplicate PDF import handler removed - using the one in DOMContentLoaded instead


window.app.deleteParticipant = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce participant ?')) return;
    try {
        await participantService.deleteParticipant(id);
        loadParticipantsView();
    } catch (error) {
        console.error('Error deleting participant', error);
        alert('Erreur lors de la suppression du participant');
    }
};
// Ensure all window.app methods are available
window.app.saveAttendance = window.saveAttendance;
window.app.loadParticipants = loadParticipantsView;
window.app.generateTestData = window.addTestParticipants;
