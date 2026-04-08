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

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', async (raw) => {
        const data = JSON.parse(raw);
        console.log('Button pressed:', data.button);

        // vertaal controller knoppen naar toetsenbord input
        if (data.button === 'up')       await keyboard.type(Key.W);
        if (data.button === 'down')     await keyboard.type(Key.S);
        if (data.button === 'left')     await keyboard.type(Key.A);
        if (data.button === 'right')    await keyboard.type(Key.D);
        if (data.button === 'letter-a') await keyboard.type(Key.Space);
        if (data.button === 'letter-b') await keyboard.type(Key.B);
        if (data.button === 'letter-x') await keyboard.type(Key.X);
        if (data.button === 'letter-y') await keyboard.type(Key.Y);
        if (data.button === 'esc')      await keyboard.type(Key.Escape);

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ response: data.button }));
            }
        });
    });
});

server.listen(8081, () => {
    console.log('Server running on http://localhost:8081');
});