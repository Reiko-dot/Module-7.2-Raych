const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { keyboard, Key } = require('@nut-tree-fork/nut-js');

const server = http.createServer((req, res) => {
    let file = req.url === '/' ? 'index.html' : req.url.slice(1);
    const filePath = path.join(__dirname, file);

    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(file);
        const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
        res.end(data);
    });
});

const wss = new WebSocket.Server({ server });

// ── Key mappings ──────────────────────────────────────────────────────────────

const dpadKeyMap = {
    'up':    Key.W,
    'down':  Key.S,
    'left':  Key.A,
    'right': Key.D,
};

const faceKeyMap = {
    'letter-a': Key.Space,
    'letter-b': Key.B,
    'letter-x': Key.X,
    'letter-y': Key.Y,
};

const miscKeyMap = {
    'select': Key.Enter,
    'esc':    Key.Escape,
    'center': Key.F,
};

const stickKeyMap = {
    'stick-up':    Key.W,
    'stick-down':  Key.S,
    'stick-left':  Key.A,
    'stick-right': Key.D,
};

const rstickKeyMap = {
    'rstick-up':    Key.Up,
    'rstick-down':  Key.Down,
    'rstick-left':  Key.Left,
    'rstick-right': Key.Right,
};

const allKeyMap = { ...dpadKeyMap, ...faceKeyMap, ...miscKeyMap };

// ── Per-connection logic ──────────────────────────────────────────────────────

wss.on('connection', (ws) => {
    console.log('Client connected');

    const heldKeys    = new Set();
    let heldStickKey  = null;
    let heldRstickKey = null;

    ws.on('message', async (raw) => {
        let data;
        try { data = JSON.parse(raw); } catch { return; }

        const { button, action } = data;
        console.log(`${action ?? 'press'}: ${button}`);

        const isPress   = !action || action === 'press';
        const isRelease = action === 'release';

        // ── D-pad / face / misc ──
        if (allKeyMap[button]) {
            const key = allKeyMap[button];
            if (isPress && !heldKeys.has(key)) {
                heldKeys.add(key);
                await keyboard.pressKey(key);
            }
            if (isRelease && heldKeys.has(key)) {
                heldKeys.delete(key);
                await keyboard.releaseKey(key);
            }
        }

        // ── Left joystick ──
        if (button === 'stick-center' || (isRelease && button.startsWith('stick-'))) {
            if (heldStickKey !== null) {
                await keyboard.releaseKey(heldStickKey);
                heldStickKey = null;
            }
        } else if (stickKeyMap[button] && isPress) {
            const newKey = stickKeyMap[button];
            if (newKey !== heldStickKey) {
                if (heldStickKey !== null) await keyboard.releaseKey(heldStickKey);
                await keyboard.pressKey(newKey);
                heldStickKey = newKey;
            }
        }

        // ── Right joystick ──
        if (button === 'rstick-center' || (isRelease && button.startsWith('rstick-'))) {
            if (heldRstickKey !== null) {
                await keyboard.releaseKey(heldRstickKey);
                heldRstickKey = null;
            }
        } else if (rstickKeyMap[button] && isPress) {
            const newKey = rstickKeyMap[button];
            if (newKey !== heldRstickKey) {
                if (heldRstickKey !== null) await keyboard.releaseKey(heldRstickKey);
                await keyboard.pressKey(newKey);
                heldRstickKey = newKey;
            }
        }

        // Echo back
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ response: button }));
            }
        });
    });

    ws.on('close', async () => {
        console.log('Client disconnected');
        for (const key of heldKeys) await keyboard.releaseKey(key);
        heldKeys.clear();
        if (heldStickKey  !== null) { await keyboard.releaseKey(heldStickKey);  heldStickKey  = null; }
        if (heldRstickKey !== null) { await keyboard.releaseKey(heldRstickKey); heldRstickKey = null; }
    });
});

server.listen(8081, () => {
    console.log('Server running on http://localhost:8081');
});