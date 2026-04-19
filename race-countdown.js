const win = window;
const socket = win.io();

function el(id) { return document.getElementById(id); }

socket.on('timerUpdate', data => {
    const m = Math.floor(data.remainingSeconds / 60);
    const s = data.remainingSeconds % 60;
    el('countdown').textContent = m + ':' + String(s).padStart(2, '0');

    // Progress bar color based on time left
    const pct = data.totalDuration > 0 ? (data.remainingSeconds / data.totalDuration) * 100 : 100;
    const bar = el('progressBar');
    bar.style.width = pct + '%';
    if (pct > 50) bar.style.background = '#4CAF50';
    else if (pct > 20) bar.style.background = '#ffc107';
    else bar.style.background = '#f44336';
});

socket.on('raceModeChanged', mode => { el('modeLabel').textContent = 'Mode: ' + mode; });
socket.on('raceFinished',    ()   => { el('modeLabel').textContent = 'Mode: Finish'; });
socket.on('raceStarted',     ()   => { el('modeLabel').textContent = 'Mode: Safe'; });

function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
}

win.toggleFullscreen = toggleFullscreen;
