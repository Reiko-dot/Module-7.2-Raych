const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { keyboard, Key } = require('@nut-tree-fork/nut-js');

// ── HTTP server ───────────────────────────────────────────────────────────────
// Serves index.html and style.css when you open the page in your browser
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
// Listens for button messages from the controller (phone)
const wss = new WebSocket.Server({ server });

// ── Key mappings ──────────────────────────────────────────────────────────────
// These define which keyboard key gets pressed for each controller button.
// Change these if you want different keys for your game.

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

// Left joystick → WASD (held down while the stick is pushed)
const stickKeyMap = {
    'stick-up':    Key.W,
    'stick-down':  Key.S,
    'stick-left':  Key.A,
    'stick-right': Key.D,
};

// Right joystick → arrow keys (held down while the stick is pushed)
const rstickKeyMap = {
    'rstick-up':    Key.Up,
    'rstick-down':  Key.Down,
    'rstick-left':  Key.Left,
    'rstick-right': Key.Right,
};

// Combine d-pad, face, and misc into one map for easy lookup
const allKeyMap = { ...dpadKeyMap, ...faceKeyMap, ...miscKeyMap };

// ── Connection handler ────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
    console.log('Client connected');

    // Track which keys are currently held so we can release them properly
    const heldKeys    = new Set(); // for d-pad / face / misc buttons
    let heldStickKey  = null;      // the key currently held by the left joystick
    let heldRstickKey = null;      // the key currently held by the right joystick

    // Watchdog timers: if no joystick message arrives within 300ms, auto-release the stuck key
    // This fixes the "character keeps moving" bug when a release message gets lost
    let stickWatchdog  = null;
    let rstickWatchdog = null;

    function resetStickWatchdog() {
        clearTimeout(stickWatchdog);
        stickWatchdog = setTimeout(async () => {
            if (heldStickKey !== null) {
                console.log('Watchdog: releasing stuck left stick key');
                await keyboard.releaseKey(heldStickKey);
                heldStickKey = null;
            }
        }, 300);
    }

    function resetRstickWatchdog() {
        clearTimeout(rstickWatchdog);
        rstickWatchdog = setTimeout(async () => {
            if (heldRstickKey !== null) {
                console.log('Watchdog: releasing stuck right stick key');
                await keyboard.releaseKey(heldRstickKey);
                heldRstickKey = null;
            }
        }, 300);
    }

    ws.on('message', async (raw) => {
        let data;
        try { data = JSON.parse(raw); } catch { return; } // ignore invalid messages

        const { button, action } = data;
        console.log(`${action ?? 'press'}: ${button}`);

        const isPress   = !action || action === 'press';
        const isRelease = action === 'release';

        // ── D-pad / face / misc buttons ──
        // Press the key when the button is pressed, release it when the button is released
        if (allKeyMap[button]) {
            const key = allKeyMap[button];
            if (isPress && !heldKeys.has(key)) {
                heldKeys.add(key);
                await keyboard.pressKey(key); // hold the key down
            }
            if (isRelease && heldKeys.has(key)) {
                heldKeys.delete(key);
                await keyboard.releaseKey(key); // let the key go
            }
        }

        // ── Left joystick ──
        // When the stick moves to a new direction: release the old key, press the new one
        // When the stick returns to center: release whatever was held
        if (button === 'stick-center' || (isRelease && button.startsWith('stick-'))) {
            clearTimeout(stickWatchdog); // no longer needed, stick is centered
            if (heldStickKey !== null) {
                await keyboard.releaseKey(heldStickKey);
                heldStickKey = null;
            }
        } else if (stickKeyMap[button] && isPress) {
            const newKey = stickKeyMap[button];
            if (newKey !== heldStickKey) {
                if (heldStickKey !== null) await keyboard.releaseKey(heldStickKey); // release old direction
                await keyboard.pressKey(newKey); // press new direction
                heldStickKey = newKey;
            }
            resetStickWatchdog(); // restart the watchdog every time a direction is held
        }

        // ── Right joystick ── (same logic as left joystick)
        if (button === 'rstick-center' || (isRelease && button.startsWith('rstick-'))) {
            clearTimeout(rstickWatchdog); // no longer needed, stick is centered
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
            resetRstickWatchdog(); // restart the watchdog every time a direction is held
        }

        // Send the button name back to the controller as confirmation
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ response: button }));
            }
        });
    });

    // When the phone disconnects, release any keys that were still being held
    // This prevents keys getting "stuck" on your PC
    ws.on('close', async () => {
        console.log('Client disconnected');
        for (const key of heldKeys) await keyboard.releaseKey(key);
        heldKeys.clear();
        if (heldStickKey  !== null) { await keyboard.releaseKey(heldStickKey);  heldStickKey  = null; }
        if (heldRstickKey !== null) { await keyboard.releaseKey(heldRstickKey); heldRstickKey = null; }
    });
});

// Start the server on port 8081
server.listen(8081, () => {
    console.log('Server running on http://localhost:8081');
});