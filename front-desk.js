let socket = null;
let authenticated = false;

const win = window;

function el(id) {
    return document.getElementById(id);
}

async function authenticate() {
    const key = el('accessKey').value;
    const res = await fetch('/auth/front-desk', {
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
    socket.on('initialData', data => updateSessions(data.raceSessions));
    socket.on('sessionsUpdated', sessions => updateSessions(sessions));
}

function createSession() {
    if (!socket) return;
    socket.emit('createSession');
}

function deleteSession(sessionId) {
    if (!socket || !confirm('Delete this session?')) return;
    socket.emit('deleteSession', sessionId);
}

function addDriver(sessionId) {
    const nameInput = document.getElementById('newDriverName-' + sessionId);
    const carInput = document.getElementById('newDriverCar-' + sessionId);
    const driverName = nameInput.value.trim();
    const car = carInput.value ? parseInt(carInput.value, 10) : null;
    if (!driverName) { alert('Enter driver name'); return; }
    if (!socket) return;
    socket.emit('addDriver', { sessionId, driverName, car });
    nameInput.value = '';
    carInput.value = '';
}

function removeDriver(sessionId, driverName) {
    if (!socket) return;
    socket.emit('removeDriver', { sessionId, driverName });
}

function editDriver(sessionId, oldName, oldCar) {
    const rowId = 'drow-' + sessionId + '-' + oldName;
    const row = document.getElementById(rowId);
    if (!row) return;
    row.innerHTML =
        '<input type="text" id="ename-' + sessionId + '" value="' + oldName + '" style="width:120px">' +
        '<select id="ecar-' + sessionId + '">' +
        [1,2,3,4,5,6,7,8].map(n => '<option value="' + n + '"' + (n === oldCar ? ' selected' : '') + '>Car ' + n + '</option>').join('') +
        '</select>' +
        '<button onclick="saveEdit(' + sessionId + ', \'' + oldName + '\')">Save</button>' +
        '<button onclick="cancelEdit()">Cancel</button>';
}

function saveEdit(sessionId, oldName) {
    const nameInput = document.getElementById('ename-' + sessionId);
    const carSelect = document.getElementById('ecar-' + sessionId);
    const newName = nameInput.value.trim();
    const car = parseInt(carSelect.value, 10);
    if (!newName) { alert('Name cannot be empty'); return; }
    if (!socket) return;
    socket.emit('updateDriver', { sessionId, oldName, newName, car });
}

function cancelEdit() {
    // just reload view - server will push fresh data on next update
    socket.emit('createSession'); // triggers nothing harmful, we just need a re-render
    // actually simplest: request fresh data
    location.reload();
}

function updateSessions(sessions) {
    const container = el('sessions');
    container.innerHTML = '';

    if (sessions.length === 0) {
        container.innerHTML = '<p>No sessions yet.</p>';
        return;
    }

    sessions.forEach(session => {
        const canEdit = session.status === 'upcoming';
        const div = document.createElement('div');
        div.className = 'session';

        let html = '<h3>Session #' + session.id + ' (' + session.status + ')';
        if (canEdit) html += ' <button onclick="deleteSession(' + session.id + ')">Delete</button>';
        html += '</h3>';
        html += '<ul>';

        session.drivers.forEach(driver => {
            const safeRowId = 'drow-' + session.id + '-' + driver.name;
            html += '<li class="driver-row" id="' + safeRowId + '">';
            html += '<span>' + driver.name + ' — Car #' + driver.car + '</span>';
            if (canEdit) {
                html += '<button onclick="editDriver(' + session.id + ', \'' + driver.name + '\', ' + driver.car + ')">Edit</button>';
                html += '<button onclick="removeDriver(' + session.id + ', \'' + driver.name + '\')">Remove</button>';
            }
            html += '</li>';
        });

        if (session.drivers.length === 0) html += '<li>No drivers</li>';
        html += '</ul>';

        if (canEdit && session.drivers.length < 8) {
            html += '<div class="add-form">';
            html += '<input type="text" id="newDriverName-' + session.id + '" placeholder="Driver name">';
            html += '<select id="newDriverCar-' + session.id + '">';
            html += '<option value="">Auto-assign car</option>';
            [1,2,3,4,5,6,7,8].forEach(n => { html += '<option value="' + n + '">Car ' + n + '</option>'; });
            html += '</select>';
            html += '<button onclick="addDriver(' + session.id + ')">Add Driver</button>';
            html += '</div>';
        }
        if (session.drivers.length >= 8) html += '<p>Full (8/8)</p>';

        div.innerHTML = html;
        container.appendChild(div);
    });
}

el('accessKey').addEventListener('keydown', e => { if (e.key === 'Enter') authenticate(); });

win.authenticate = authenticate;
win.createSession = createSession;
win.deleteSession = deleteSession;
win.addDriver = addDriver;
win.removeDriver = removeDriver;
win.editDriver = editDriver;
win.saveEdit = saveEdit;
win.cancelEdit = cancelEdit;
