const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { keyboard, Key } = require('@nut-tree-fork/nut-js');

// ── HTTP server ───────────────────────────────────────────────────────────────
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

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocket.Server({ server });

// ── Key mappings ──────────────────────────────────────────────────────────────

// D-pad → WASD
const dpadKeyMap = {
    'up':    Key.W,
    'down':  Key.S,
    'left':  Key.A,
    'right': Key.D,
};

// Face buttons (A/B/X/Y)
const faceKeyMap = {
    'letter-a': Key.Space,
    'letter-b': Key.B,
    'letter-x': Key.X,
    'letter-y': Key.Y,
};

// Other buttons (Select, ESC, D-pad center)
const miscKeyMap = {
    'select': Key.Enter,
    'esc':    Key.Escape,
    'center': Key.F,
};

const allKeyMap = { ...dpadKeyMap, ...faceKeyMap, ...miscKeyMap };

// ── Connection handler ────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
    console.log('Client connected');

    const heldKeys = new Set();

    ws.on('message', async (raw) => {
        let data;
        try { data = JSON.parse(raw); } catch { return; }

        const { button, action } = data;
        console.log(`${action ?? 'press'}: ${button}`);

        const isPress   = !action || action === 'press';
        const isRelease = action === 'release';

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
    });
});

server.listen(8081, () => {
    console.log('Server running on http://localhost:8081');
});