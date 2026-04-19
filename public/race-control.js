let socket = null;
let authenticated = false;
let currentMode = 'Danger';

const win = window;

function el(id) { return document.getElementById(id); }
function inp(id) { return document.getElementById(id); }

async function authenticate() {
    const key = inp('accessKey').value;
    const res = await fetch('/auth/race-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
    });
    const result = await res.json();
    if (result.success) {
        authenticated = true;
        el('auth').style.display = 'none';
        el('main').style.display = 'block';
        initSocket();
    } else {
        el('authError').textContent = result.message || 'Wrong access key';
    }
}

function initSocket() {
    socket = win.io();

    socket.on('initialData', data => {
        updateCurrentSession(data.raceSessions, data.currentSessionId);
        updateModeButtons(data.raceMode);
        // If race already running, show mode controls
        const session = data.raceSessions.find(s => s.id === data.currentSessionId);
        if (session && session.status === 'current') {
            el('modeControls').style.display = 'block';
            el('startRaceBtn').style.display = 'none';
            if (data.raceMode === 'Finish') el('endSessionBtn').style.display = 'inline';
        }
    });

    socket.on('raceStarted', data => {
        updateCurrentSession([data.session], data.session.id);
        updateModeButtons(data.raceMode);
        el('modeControls').style.display = 'block';
        el('startRaceBtn').style.display = 'none';
        el('endSessionBtn').style.display = 'none';
    });

    socket.on('timerUpdate', data => updateTimer(data));

    socket.on('raceModeChanged', mode => {
        updateModeButtons(mode);
        if (mode === 'Finish') el('endSessionBtn').style.display = 'inline';
    });

    socket.on('raceFinished', () => {
        updateModeButtons('Finish');
        el('endSessionBtn').style.display = 'inline';
    });

    socket.on('sessionEnded', data => {
        updateModeButtons(data.raceMode);
        el('modeControls').style.display = 'none';
        el('startRaceBtn').style.display = 'inline';
        el('endSessionBtn').style.display = 'none';
    });

    socket.on('sessionsUpdated', sessions => {
        const cur = sessions.find(s => s.status === 'current');
        updateCurrentSession(sessions, cur ? cur.id : null);
    });
}

function startRace() {
    if (!socket) return;
    socket.emit('startRace');
}

function setMode(mode) {
    if (!socket) return;
    socket.emit('setRaceMode', mode);
}

function endSession() {
    if (!socket || !confirm('End session? All cars back in pit lane?')) return;
    socket.emit('endSession');
}

function updateCurrentSession(sessions, currentId) {
    const div = el('currentSession');
    if (currentId !== null) {
        const session = sessions.find(s => s.id === currentId);
        if (session) {
            let html = '<strong>Session #' + session.id + ' — ' + session.status + '</strong><ul>';
            session.drivers.forEach(d => { html += '<li>Car #' + d.car + ' — ' + d.name + '</li>'; });
            if (session.drivers.length === 0) html += '<li>No drivers</li>';
            html += '</ul>';
            div.innerHTML = html;
            return;
        }
    }
    // Show next upcoming for briefing
    const upcoming = sessions.find(s => s.status === 'upcoming');
    if (upcoming) {
        let html = '<strong>Next session (ready to start): Session #' + upcoming.id + '</strong><ul>';
        upcoming.drivers.forEach(d => { html += '<li>Car #' + d.car + ' — ' + d.name + '</li>'; });
        if (upcoming.drivers.length === 0) html += '<li>No drivers</li>';
        html += '</ul>';
        div.innerHTML = html;
    } else {
        div.innerHTML = '<p>No sessions available. Set up a session at Front Desk first.</p>';
    }
}

function updateTimer(data) {
    const m = Math.floor(data.remainingSeconds / 60);
    const s = data.remainingSeconds % 60;
    el('timer').textContent = m + ':' + String(s).padStart(2, '0');
}

function updateModeButtons(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(mode.toLowerCase());
    if (btn) btn.classList.add('active');
}

el('accessKey').addEventListener('keydown', e => { if (e.key === 'Enter') authenticate(); });

win.authenticate = authenticate;
win.startRace = startRace;
win.setMode = setMode;
win.endSession = endSession;
