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

// Left joystick → WASD (held while direction is active)
const stickKeyMap = {
    'stick-up':    Key.W,
    'stick-down':  Key.S,
    'stick-left':  Key.A,
    'stick-right': Key.D,
};

// Right joystick → arrow keys (held while direction is active)
const rstickKeyMap = {
    'rstick-up':    Key.Up,
    'rstick-down':  Key.Down,
    'rstick-left':  Key.Left,
    'rstick-right': Key.Right,
};

// Track which key is currently held per joystick so we can release it
let heldStickKey  = null;
let heldRstickKey = null;

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', async (raw) => {
        const data = JSON.parse(raw);
        console.log('Button pressed:', data.button);

        // ── D-pad → single key taps ──
        if (data.button === 'up')       await keyboard.type(Key.W);
        if (data.button === 'down')     await keyboard.type(Key.S);
        if (data.button === 'left')     await keyboard.type(Key.A);
        if (data.button === 'right')    await keyboard.type(Key.D);
        if (data.button === 'letter-a') await keyboard.type(Key.Space);
        if (data.button === 'letter-b') await keyboard.type(Key.B);
        if (data.button === 'letter-x') await keyboard.type(Key.X);
        if (data.button === 'letter-y') await keyboard.type(Key.Y);
        if (data.button === 'esc')      await keyboard.type(Key.Escape);

        // ── Left joystick → WASD held ──
        if (data.button.startsWith('stick-') && !data.button.startsWith('stick-') === false) {
            // handled below
        }
        if (data.button === 'stick-center') {
            if (heldStickKey !== null) {
                await keyboard.releaseKey(heldStickKey);
                heldStickKey = null;
            }
        } else if (stickKeyMap[data.button]) {
            const newKey = stickKeyMap[data.button];
            if (newKey !== heldStickKey) {
                if (heldStickKey !== null) await keyboard.releaseKey(heldStickKey);
                await keyboard.pressKey(newKey);
                heldStickKey = newKey;
            }
        }

        // ── Right joystick → arrow keys held ──
        if (data.button === 'rstick-center') {
            if (heldRstickKey !== null) {
                await keyboard.releaseKey(heldRstickKey);
                heldRstickKey = null;
            }
        } else if (rstickKeyMap[data.button]) {
            const newKey = rstickKeyMap[data.button];
            if (newKey !== heldRstickKey) {
                if (heldRstickKey !== null) await keyboard.releaseKey(heldRstickKey);
                await keyboard.pressKey(newKey);
                heldRstickKey = newKey;
            }
        }

        // Echo back to all clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ response: data.button }));
            }
        });
    });

    // Release any held keys if the client disconnects mid-hold
    ws.on('close', async () => {
        console.log('Client disconnected');
        if (heldStickKey !== null)  { await keyboard.releaseKey(heldStickKey);  heldStickKey = null; }
        if (heldRstickKey !== null) { await keyboard.releaseKey(heldRstickKey); heldRstickKey = null; }
    });
});

server.listen(8081, () => {
    console.log('Server running on http://localhost:8081');
});