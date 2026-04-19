const win = window;
const socket = win.io();

let sessions = [];
let currentSessionId = null;
let showPaddockMessage = false;

function el(id) { return document.getElementById(id); }

socket.on('initialData', data => {
    sessions = data.raceSessions;
    currentSessionId = data.currentSessionId;
    showPaddockMessage = false;
    updateDisplay();
});

socket.on('sessionsUpdated', updated => {
    sessions = updated;
    updateDisplay();
});

socket.on('raceStarted', () => {
    // Show NEXT upcoming session after current one starts
    showPaddockMessage = false;
    const idx = sessions.findIndex(s => s.id === currentSessionId);
    if (idx >= 0 && idx < sessions.length - 1) {
        currentSessionId = sessions[idx + 1].id;
    } else {
        currentSessionId = null;
    }
    updateDisplay();
});

socket.on('sessionEnded', data => {
    currentSessionId = data.currentSessionId;
    showPaddockMessage = true;
    updateDisplay();
});

function updateDisplay() {
    const messageEl = el('message');
    const listEl = el('driversList');
    const paddockEl = el('paddockMessage');

    let session = null;
    if (currentSessionId !== null) {
        session = sessions.find(s => s.id === currentSessionId) || null;
    }
    if (!session) {
        session = sessions.find(s => s.status === 'upcoming') || null;
    }

    if (session) {
        messageEl.textContent = 'Next Race - Session #' + session.id;
        listEl.innerHTML = session.drivers.map(d =>
            '<li><span>' + d.name + '</span><span>Car #' + d.car + '</span></li>'
        ).join('') || '<li class="empty">No drivers assigned yet</li>';
        paddockEl.style.display = showPaddockMessage ? 'block' : 'none';
    } else {
        messageEl.textContent = 'No upcoming races';
        listEl.innerHTML = '<li class="empty">Check back soon.</li>';
        paddockEl.style.display = 'none';
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
}

win.toggleFullscreen = toggleFullscreen;
