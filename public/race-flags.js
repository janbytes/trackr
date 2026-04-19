const win = window;
const socket = win.io();

const body = document.body;
const flagText = document.getElementById('flag-text');

socket.on('initialData',    data => setFlag(data.raceMode));
socket.on('raceModeChanged', mode => setFlag(mode));
socket.on('raceStarted',    data => setFlag(data.raceMode));
socket.on('raceFinished',   ()   => setFlag('Finish'));
socket.on('sessionEnded',   data => setFlag(data.raceMode));

function setFlag(mode) {
    if (!flagText) return;
    body.style.backgroundImage = 'none';
    switch (mode) {
        case 'Safe':
            body.style.background = 'green';
            flagText.textContent = 'SAFE';
            flagText.style.color = 'white';
            break;
        case 'Hazard':
            body.style.background = 'yellow';
            flagText.textContent = 'HAZARD';
            flagText.style.color = 'black';
            break;
        case 'Danger':
            body.style.background = 'red';
            flagText.textContent = 'DANGER';
            flagText.style.color = 'white';
            break;
        case 'Finish':
            body.style.background = 'white';
            body.style.backgroundImage = 'repeating-conic-gradient(from 0deg, black 0deg 90deg, white 90deg 180deg)';
            body.style.backgroundSize = '100px 100px';
            flagText.textContent = 'FINISH';
            flagText.style.color = 'black';
            break;
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
}

win.toggleFullscreen = toggleFullscreen;
