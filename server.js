require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const isDev = process.argv.includes('--dev');
// 1 min in dev, 10 min in prod
const raceDuration = isDev ? 60 * 1000 : 10 * 60 * 1000;

// -- Check required env vars before starting --
const receptionistKey = process.env.receptionist_key;
const observerKey = process.env.observer_key;
const safetyKey = process.env.safety_key;

if (!receptionistKey || !observerKey || !safetyKey) {
    console.error('Error: Environment variables must be set before starting.');
    console.error('Usage:');
    console.error('  export receptionist_key=<key>');
    console.error('  export observer_key=<key>');
    console.error('  export safety_key=<key>');
    console.error('  npm start');
    process.exit(1);
}

// -- Data structures --
/** @type {Array<{id: number, drivers: Array<{name: string, car: number}>, status: 'upcoming'|'current'|'finished'}>} */
let raceSessions = [];

/** @type {number|null} */
let currentSessionId = null;

/** @type {'Safe'|'Hazard'|'Danger'|'Finish'} */
let raceMode = 'Danger';

/** @type {ReturnType<typeof setInterval>|null} */
let raceTimerInterval = null;

/** @type {number|null} */
let raceStartTime = null;

/** @type {number|null} */
let pausedRemaining = null;

/** @type {Record<number, {laps: number, bestLap: number|null, lastLapTime: number|null}>} */
let carStats = {};

// -- Timer helpers --

function clearRaceTimer() {
    if (raceTimerInterval !== null) {
        clearInterval(raceTimerInterval);
        raceTimerInterval = null;
    }
}

function getRemainingTime() {
    let remaining;
    // Clock is actively ticking in Safe and Hazard modes
    if (raceStartTime !== null) {
        const elapsed = Date.now() - raceStartTime;
        remaining = Math.max(0, raceDuration - elapsed);
    } else if (pausedRemaining !== null) {
        // Danger mode: clock is frozen
        remaining = pausedRemaining;
    } else {
        remaining = raceDuration;
    }
    return {
        remainingSeconds: Math.ceil(remaining / 1000),
        totalDuration: raceDuration / 1000,
    };
}

function emitTimerUpdate() {
    io.emit('timerUpdate', getRemainingTime());
}

function startTimerLoop() {
    // Always clear existing interval first to avoid duplicates
    clearRaceTimer();
    raceTimerInterval = setInterval(() => {
        const status = getRemainingTime();
        io.emit('timerUpdate', status);
        // Auto-finish when time runs out
        if (status.remainingSeconds <= 0) {
            handleRaceFinish();
        }
    }, 1000);
}

function handleRaceFinish() {
    clearRaceTimer();
    raceMode = 'Finish';
    raceStartTime = null;
    pausedRemaining = 0;
    io.emit('raceModeChanged', raceMode);
    io.emit('raceFinished');
    saveData();
}

// -- Persistence --
const dataFile = path.join(__dirname, 'data.json');

function saveData() {
    const elapsed = raceStartTime ? Date.now() - raceStartTime : 0;
    const data = {
        raceSessions,
        currentSessionId,
        raceMode,
        carStats,
        pausedRemaining,
        elapsedTime: elapsed,
    };
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function loadData() {
    if (fs.existsSync(dataFile)) {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        raceSessions = data.raceSessions || [];
        currentSessionId = data.currentSessionId ?? null;
        raceMode = data.raceMode || 'Danger';
        carStats = data.carStats || {};
        pausedRemaining = data.pausedRemaining ?? null;

        // Restore running timer if race was active
        if ((data.raceMode === 'Safe' || data.raceMode === 'Hazard') && data.elapsedTime > 0) {
            raceStartTime = Date.now() - data.elapsedTime;
            startTimerLoop();
        }
    }
}

loadData();

// -- Serve frontend --
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => res.redirect('/next-race'));
app.get('/front-desk', (req, res) => res.sendFile(path.join(__dirname, 'public', 'front-desk.html')));
app.get('/race-control', (req, res) => res.sendFile(path.join(__dirname, 'public', 'race-control.html')));
app.get('/lap-line-tracker', (req, res) => res.sendFile(path.join(__dirname, 'public', 'lap-line-tracker.html')));
app.get('/leader-board', (req, res) => res.sendFile(path.join(__dirname, 'public', 'leader-board.html')));
app.get('/next-race', (req, res) => res.sendFile(path.join(__dirname, 'public', 'next-race.html')));
app.get('/race-countdown', (req, res) => res.sendFile(path.join(__dirname, 'public', 'race-countdown.html')));
app.get('/race-flags', (req, res) => res.sendFile(path.join(__dirname, 'public', 'race-flags.html')));

// -- Auth endpoints --
// 500ms delay on wrong key to slow down brute-force attempts
app.post('/auth/front-desk', (req, res) => {
    const { key } = req.body;
    setTimeout(() => {
        if (key === receptionistKey) res.json({ success: true });
        else res.status(401).json({ success: false, message: 'Invalid access key' });
    }, key === receptionistKey ? 0 : 500);
});

app.post('/auth/race-control', (req, res) => {
    const { key } = req.body;
    setTimeout(() => {
        if (key === safetyKey) res.json({ success: true });
        else res.status(401).json({ success: false, message: 'Invalid access key' });
    }, key === safetyKey ? 0 : 500);
});

app.post('/auth/lap-line-tracker', (req, res) => {
    const { key } = req.body;
    setTimeout(() => {
        if (key === observerKey) res.json({ success: true });
        else res.status(401).json({ success: false, message: 'Invalid access key' });
    }, key === observerKey ? 0 : 500);
});

// -- Socket.IO --
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send full state on connect
    socket.emit('initialData', { raceSessions, currentSessionId, raceMode, carStats });
    socket.emit('timerUpdate', getRemainingTime());

    // ---- FRONT DESK ----

    socket.on('createSession', () => {
        const newId = raceSessions.length === 0
            ? 1
            : Math.max(...raceSessions.map(s => s.id)) + 1;
        raceSessions.push({ id: newId, drivers: [], status: 'upcoming' });
        io.emit('sessionsUpdated', raceSessions);
        saveData();
    });

    socket.on('deleteSession', (/** @type {number} */ sessionId) => {
        raceSessions = raceSessions.filter(s => s.id !== sessionId);
        if (currentSessionId === sessionId) currentSessionId = null;
        io.emit('sessionsUpdated', raceSessions);
        saveData();
    });

    socket.on('addDriver', (/** @type {{sessionId: number, driverName: string, car: number|null}} */ payload) => {
        const { sessionId, driverName, car } = payload;
        const session = raceSessions.find(s => s.id === sessionId);
        if (!session) return;
        if (session.drivers.length >= 8) return;
        if (session.drivers.some(d => d.name === driverName)) return;

        // Auto-assign car if not provided or already taken
        let assignedCar = car;
        if (!assignedCar || session.drivers.some(d => d.car === assignedCar)) {
            const usedCars = session.drivers.map(d => d.car);
            assignedCar = [1, 2, 3, 4, 5, 6, 7, 8].find(c => !usedCars.includes(c)) || 1;
        }

        session.drivers.push({ name: driverName, car: assignedCar });
        io.emit('sessionsUpdated', raceSessions);
        saveData();
    });

    socket.on('removeDriver', (/** @type {{sessionId: number, driverName: string}} */ payload) => {
        const { sessionId, driverName } = payload;
        const session = raceSessions.find(s => s.id === sessionId);
        if (!session) return;
        session.drivers = session.drivers.filter(d => d.name !== driverName);
        io.emit('sessionsUpdated', raceSessions);
        saveData();
    });

    socket.on('updateDriver', (/** @type {{sessionId: number, oldName: string, newName: string, car: number}} */ payload) => {
        const { sessionId, oldName, newName, car } = payload;
        const session = raceSessions.find(s => s.id === sessionId);
        if (!session) return;
        const driver = session.drivers.find(d => d.name === oldName);
        if (!driver) return;
        // Name must be unique (ignoring self) and car must not be taken by another driver
        if (session.drivers.some(d => d.name === newName && d !== driver)) return;
        if (session.drivers.some(d => d.car === car && d !== driver)) return;
        driver.name = newName;
        driver.car = car;
        io.emit('sessionsUpdated', raceSessions);
        saveData();
    });

    // ---- LAP TRACKER ----

    socket.on('lapCompleted', (/** @type {{car: number, lapTime: number}} */ payload) => {
        const { car, lapTime } = payload;
        if (!carStats[car]) carStats[car] = { laps: 0, bestLap: null, lastLapTime: null };
        carStats[car].laps += 1;
        carStats[car].lastLapTime = lapTime;
        if (carStats[car].bestLap === null || lapTime < carStats[car].bestLap) {
            carStats[car].bestLap = lapTime;
        }
        io.emit('carStatsUpdated', carStats);
        saveData();
    });

    // ---- RACE CONTROL ----

    socket.on('startRace', () => {
        // Find the first upcoming session if no current one
        if (!currentSessionId) {
            const upcoming = raceSessions.find(s => s.status === 'upcoming');
            if (upcoming) currentSessionId = upcoming.id;
            else return;
        }

        const session = raceSessions.find(s => s.id === currentSessionId);
        if (!session) return;

        session.status = 'current';
        clearRaceTimer();
        raceStartTime = Date.now();
        pausedRemaining = null;
        raceMode = 'Safe';

        // Initialize lap stats for all cars in this session
        session.drivers.forEach(d => {
            carStats[d.car] = { laps: 0, bestLap: null, lastLapTime: null };
        });

        startTimerLoop();
        io.emit('raceModeChanged', raceMode);
        io.emit('raceStarted', { session, carStats, raceMode });
        saveData();
    });

    socket.on('setRaceMode', (/** @type {'Safe'|'Hazard'|'Danger'|'Finish'} */ mode) => {
        if (raceMode === mode) return;
        if (raceMode === 'Finish') return; // can't change mode after finish

        const oldMode = raceMode;
        raceMode = mode;

        const isRunningMode = mode === 'Safe' || mode === 'Hazard';
        const wasRunningMode = oldMode === 'Safe' || oldMode === 'Hazard';

        if (isRunningMode) {
            // Coming back from Danger (paused) — recalculate start time
            if (oldMode === 'Danger' && pausedRemaining !== null) {
                raceStartTime = Date.now() - (raceDuration - pausedRemaining);
                pausedRemaining = null;
                startTimerLoop();
            }
            // Safe <-> Hazard: clock keeps running, nothing to do
        } else if (mode === 'Danger') {
            // Freeze the clock
            if (raceStartTime !== null) {
                const elapsed = Date.now() - raceStartTime;
                pausedRemaining = Math.max(0, raceDuration - elapsed);
                raceStartTime = null;
                clearRaceTimer();
            }
        } else if (mode === 'Finish') {
            handleRaceFinish();
            return; // handleRaceFinish emits its own events
        }

        io.emit('raceModeChanged', raceMode);
        io.emit('timerUpdate', getRemainingTime());
        saveData();
    });

    socket.on('endSession', () => {
        if (!currentSessionId) return;
        const session = raceSessions.find(s => s.id === currentSessionId);
        if (session) session.status = 'finished';

        // Make sure race is finished before ending session
        handleRaceFinish();

        // Advance to next upcoming session
        const currentIndex = raceSessions.findIndex(s => s.id === currentSessionId);
        currentSessionId = currentIndex < raceSessions.length - 1
            ? raceSessions[currentIndex + 1].id
            : null;

        // After session ends, mode goes to Danger so people can safely move around
        raceMode = 'Danger';
        raceStartTime = null;
        pausedRemaining = null;
        clearRaceTimer();

        io.emit('sessionEnded', { raceMode, currentSessionId });
        io.emit('raceModeChanged', raceMode);
        saveData();
    });

    socket.on('disconnect', () => {
        console.log('Disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Dev mode: ${isDev} (race duration: ${raceDuration / 1000}s)`);
});
