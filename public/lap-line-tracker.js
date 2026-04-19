let socket = null;
let authenticated = false;
let registeredCars = new Set();
let sessionEnded = false;
let lastTapTime = {}; // car -> timestamp, to auto-calculate lap time

const win = window;

function el(id) { return document.getElementById(id); }

async function authenticate() {
    const key = el('accessKey').value;
    const res = await fetch('/auth/lap-line-tracker', {
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
        updateRegisteredCars(data.raceSessions, data.currentSessionId);
        updateStatus(data.raceMode);
    });

    socket.on('raceStarted', data => {
        sessionEnded = false;
        lastTapTime = {};
        el('sessionEndedMsg').style.display = 'none';
        loadCarsFromSession(data.session);
        updateStatus(data.raceMode);
    });

    socket.on('timerUpdate', data => {
        const m = Math.floor(data.remainingSeconds / 60);
        const s = data.remainingSeconds % 60;
        el('timer').textContent = m + ':' + String(s).padStart(2, '0');
    });

    socket.on('raceModeChanged', mode => {
        updateStatus(mode);
        renderButtons(); // re-render to reflect any state
    });

    socket.on('raceFinished', () => {
        updateStatus('Finish');
        renderButtons();
    });

    socket.on('sessionEnded', () => {
        sessionEnded = true;
        el('sessionEndedMsg').style.display = 'block';
        renderButtons();
    });

    socket.on('sessionsUpdated', sessions => {
        const current = sessions.find(s => s.status === 'current');
        if (current) loadCarsFromSession(current);
    });
}

function updateRegisteredCars(sessions, currentId) {
    registeredCars.clear();
    if (currentId !== null) {
        const session = sessions.find(s => s.id === currentId);
        if (session) session.drivers.forEach(d => registeredCars.add(d.car));
    }
    renderButtons();
}

function loadCarsFromSession(session) {
    registeredCars.clear();
    session.drivers.forEach(d => registeredCars.add(d.car));
    renderButtons();
}

function renderButtons() {
    const carsDiv = el('cars');
    carsDiv.innerHTML = '';

    if (registeredCars.size === 0) {
        carsDiv.innerHTML = '<p>Waiting for race to start...</p>';
        return;
    }

    const sorted = Array.from(registeredCars).sort((a, b) => a - b);
    sorted.forEach(carNum => {
        const btn = document.createElement('button');
        btn.className = 'car-btn';
        btn.disabled = sessionEnded;
        btn.innerHTML = carNum + '<br><small>Car ' + carNum + '</small>';
        btn.addEventListener('click', () => recordLap(carNum));
        carsDiv.appendChild(btn);
    });
}

function recordLap(car) {
    if (sessionEnded || !socket) return;

    const now = Date.now();
    // Need at least 1 second between taps for same car
    if (lastTapTime[car] && now - lastTapTime[car] < 1000) return;

    // Calculate lap time from last tap (0 if first lap)
    const lapTime = lastTapTime[car] ? (now - lastTapTime[car]) / 1000 : 0;
    lastTapTime[car] = now;

    socket.emit('lapCompleted', { car, lapTime });
}

function updateStatus(mode) {
    el('status').textContent = 'Race Mode: ' + mode;
}

el('accessKey').addEventListener('keydown', e => { if (e.key === 'Enter') authenticate(); });

win.authenticate = authenticate;
