const win = window;
const socket = win.io();

let currentSession = null;
let carStats = {};
let drivers = [];

function el(id) { return document.getElementById(id); }

socket.on('initialData', data => updateData(data));

socket.on('sessionsUpdated', sessions => {
    const currentId = currentSession ? currentSession.id : null;
    currentSession = sessions.find(s => s.id === currentId) || sessions.find(s => s.status === 'current') || null;
    drivers = currentSession ? currentSession.drivers : [];
    updateDisplay();
});

socket.on('raceStarted', data => {
    currentSession = data.session;
    drivers = data.session.drivers;
    carStats = data.carStats;
    updateDisplay();
});

socket.on('carStatsUpdated', stats => {
    carStats = stats;
    updateDisplay();
});

socket.on('timerUpdate', data => {
    const m = Math.floor(data.remainingSeconds / 60);
    const s = data.remainingSeconds % 60;
    el('timer').textContent = m + ':' + String(s).padStart(2, '0');
});

socket.on('raceModeChanged', mode => { el('flag').textContent = 'Flag: ' + mode; });
socket.on('raceFinished', () => { el('flag').textContent = 'Flag: Finish'; });
socket.on('sessionEnded', data => { el('flag').textContent = 'Flag: ' + data.raceMode; });

function updateData(data) {
    currentSession = data.raceSessions.find(s => s.id === data.currentSessionId) || null;
    // Keep showing last finished session results
    if (!currentSession) {
        currentSession = [...data.raceSessions].reverse().find(s => s.status === 'current' || s.status === 'finished') || null;
    }
    drivers = currentSession ? currentSession.drivers : [];
    carStats = data.carStats;
    el('flag').textContent = 'Flag: ' + data.raceMode;
    updateDisplay();
}

function updateDisplay() {
    const tbody = el('leaderboardBody');
    tbody.innerHTML = '';

    if (!currentSession || drivers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No active race</td></tr>';
        return;
    }

    const rows = drivers.map(driver => ({
        ...driver,
        stats: carStats[driver.car] || { laps: 0, bestLap: null, lastLapTime: null }
    }));

    // Sort: best lap asc, then most laps
    rows.sort((a, b) => {
        if (a.stats.bestLap === null && b.stats.bestLap === null) return b.stats.laps - a.stats.laps;
        if (a.stats.bestLap === null) return 1;
        if (b.stats.bestLap === null) return -1;
        if (a.stats.bestLap !== b.stats.bestLap) return a.stats.bestLap - b.stats.bestLap;
        return b.stats.laps - a.stats.laps;
    });

    rows.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + (index + 1) + '</td>' +
            '<td>' + item.name + '</td>' +
            '<td>Car #' + item.car + '</td>' +
            '<td>' + (item.stats.bestLap !== null ? item.stats.bestLap.toFixed(2) + 's' : '-') + '</td>' +
            '<td>' + item.stats.laps + '</td>';
        tbody.appendChild(tr);
    });
}

function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
}

win.toggleFullscreen = toggleFullscreen;
