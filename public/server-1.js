const WebSocket = require('ws');
const robot = require('robotjs'); // voor toetsenbord input
const http = require('http'); // om een webserver te maken
const fs = require('fs'); // om bestanden te lezen
const path = require('path'); // om bestandspaden samen te stellen

// maak een HTTP server aan die bestanden serveert
const server = http.createServer((req, res) => {
    let file = req.url === '/' ? 'index.html' : req.url.slice(1); // standaard index.html laden
    const filePath = path.join(__dirname, file); // volledig pad naar het bestand
    
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; } // bestand niet gevonden
        
        // juiste content-type meegeven zodat browser het goed verwerkt
        const ext = path.extname(file);
        const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
        res.end(data); // stuur het bestand naar de browser
    });
});

// koppel WebSocket server aan de HTTP server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected'); // telefoon heeft verbinding gemaakt

    ws.on('message', (raw) => {
        const data = JSON.parse(raw); // binnenkomend bericht omzetten naar object
        console.log('Button pressed:', data.button); // log welke knop ingedrukt is

        // vertaal controller knoppen naar toetsenbord input
        if (data.button === 'up')       robot.keyTap('up');
        if (data.button === 'down')     robot.keyTap('down');
        if (data.button === 'left')     robot.keyTap('left');
        if (data.button === 'right')    robot.keyTap('right');
        if (data.button === 'letter-a') robot.keyTap('space');
        if (data.button === 'letter-b') robot.keyTap('b');
        if (data.button === 'letter-x') robot.keyTap('x');
        if (data.button === 'letter-y') robot.keyTap('y');
        if (data.button === 'esc')      robot.keyTap('escape');

        // stuur bevestiging terug naar de controller
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ response: data.button }));
            }
        });
    });
});

// start de server op poort 8081
server.listen(8081, () => {
    console.log('Server running on http://localhost:8081');
});