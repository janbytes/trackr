# Racetrack Info-Screens

Real-time race control system for Beachside Racetrack.

## Setup

### 1. Install dependencies
```
npm install
```

### 2. Set environment variables (required — server won't start without them)
```
export receptionist_key=your_key_here
export observer_key=your_key_here
export safety_key=your_key_here
```

### 3. Start the server
```
npm start        # 10-minute races (production)
npm run dev      # 1-minute races (development/testing)
```

Server starts on port 3000 (or set `PORT` env var).

---

## Interfaces

### Employee interfaces (password-protected)

| Interface | URL | Access key |
|---|---|---|
| Front Desk (Receptionist) | `/front-desk` | `receptionist_key` |
| Race Control (Safety Official) | `/race-control` | `safety_key` |
| Lap Line Tracker (Observer) | `/lap-line-tracker` | `observer_key` |

### Public displays (no password)

| Interface | URL |
|---|---|
| Leader Board | `/leader-board` |
| Next Race | `/next-race` |
| Race Countdown | `/race-countdown` |
| Race Flags | `/race-flags` |

---

## How it works

1. **Receptionist** opens `/front-desk`, enters key, creates a session, adds drivers (max 8 per session).
   - Cars are auto-assigned or can be chosen manually from the dropdown.
2. **Safety Official** opens `/race-control`, briefs drivers from the list shown, clicks **Start Race**.
3. **Lap-line Observer** opens `/lap-line-tracker`, taps the big car button each time that car crosses the lap line.
   - Lap times are calculated automatically from the time between taps.
4. **Spectators** watch `/leader-board` for live standings, `/race-flags` for the current flag.
5. When time runs out (or Safety Official clicks **Finish**), the chequered flag appears automatically.
6. Safety Official clicks **End Session** once all cars are back. Mode changes to Danger. Next session is shown.

---

## Data persistence

All data is saved to `data.json`. If the server restarts, all sessions and lap times are restored.

## Security

Each interface has its own access key set via environment variables.  
Wrong key = 500ms delay before error response.
