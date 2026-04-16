const WebSocket = require('ws'); // Laad de WebSocket bibliotheek in zodat telefoons kunnen verbinden
const http = require('http'); // Laad de HTTP bibliotheek in zodat de pagina kan worden geopend in de browser
const fs = require('fs'); // Laad de bestandsbibliotheek in om bestanden van de schijf te kunnen lezen
const path = require('path'); // Laad de padbibliotheek in om bestandspaden correct samen te stellen
const { keyboard, Key } = require('@nut-tree-fork/nut-js'); // Laad de bibliotheek in die toetsaanslagen op de computer kan simuleren

// ── HTTP server ───────────────────────────────────────────────────────────────
// Dit gedeelte zorgt ervoor dat je de controller-pagina kunt openen in de browser

const server = http.createServer((req, res) => { // Maak een webserver aan die reageert op verzoeken
    let file = req.url === '/' ? 'index.html' : req.url.slice(1); // Als iemand de hoofdpagina opvraagt, stuur index.html, anders het gevraagde bestand
    const filePath = path.join(__dirname, file); // Stel het volledige pad samen naar het bestand op de schijf

    fs.readFile(filePath, (err, data) => { // Probeer het bestand te lezen
        if (err) { res.writeHead(404); res.end('Not found'); return; } // Als het bestand niet bestaat, stuur een 404 foutmelding
        const ext = path.extname(file); // Haal de bestandsextensie op (bijv. .html, .css, .js)
        const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }; // Koppel extensies aan het juiste bestandstype
        res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' }); // Stuur de juiste header mee zodat de browser weet wat voor bestand het is
        res.end(data); // Stuur de inhoud van het bestand naar de browser
    });
});

// ── WebSocket server ──────────────────────────────────────────────────────────
// Dit gedeelte zorgt voor de live verbinding met de telefoon

const wss = new WebSocket.Server({ server }); // Maak een WebSocket server aan die meeloopt op dezelfde server

// ── Key mappings ──────────────────────────────────────────────────────────────
// Hier staat welke knop op de controller overeenkomt met welke toets op het toetsenbord

// D-pad richtingsknoppen → WASD toetsen
const dpadKeyMap = {
    'up':    Key.W, // Omhoog = W
    'down':  Key.S, // Omlaag = S
    'left':  Key.A, // Links = A
    'right': Key.D, // Rechts = D
};

// Face knoppen (A/B/X/Y) → toetsenbordtoetsen
const faceKeyMap = {
    'letter-a': Key.Space, // A knop = Spatiebalk
    'letter-b': Key.B,     // B knop = B toets
    'letter-x': Key.X,     // X knop = X toets
    'letter-y': Key.Y,     // Y knop = Y toets
};

// Overige knoppen (Select, ESC, midden van d-pad)
const miscKeyMap = {
    'select': Key.Enter,  // Select = Enter
    'esc':    Key.Escape, // ESC = Escape
    'center': Key.F,      // Midden = F toets
};

const allKeyMap = { ...dpadKeyMap, ...faceKeyMap, ...miscKeyMap }; // Voeg alle drie de lijsten samen tot één grote lijst

// ── Connection handler ────────────────────────────────────────────────────────
// Dit gedeelte wordt uitgevoerd zodra een telefoon verbinding maakt

wss.on('connection', (ws) => {
    console.log('Client connected'); // Laat in de terminal zien dat er iemand verbonden is

    const heldKeys = new Set(); // Onthoud welke toetsen momenteel ingedrukt zijn (om dubbele presses te voorkomen)

    ws.on('message', async (raw) => { // Elke keer dat de telefoon een bericht stuurt...
        let data;
        try { data = JSON.parse(raw); } catch { return; } // Zet het bericht om naar leesbare data, stop als het niet lukt

        const { button, action } = data; // Haal de knoopnaam en actie (press/release) uit het bericht
        console.log(`${action ?? 'press'}: ${button}`); // Laat in de terminal zien welke knop werd ingedrukt of losgelaten

        const isPress   = !action || action === 'press';   // Is dit een indrukactie?
        const isRelease = action === 'release';             // Is dit een loslaatactie?

        if (allKeyMap[button]) { // Controleer of deze knop een bijbehorende toets heeft
            const key = allKeyMap[button]; // Zoek de bijbehorende toetsenbordtoets op
            if (isPress && !heldKeys.has(key)) { // Als het een druk is én de toets wordt nog niet ingehouden...
                heldKeys.add(key); // Voeg de toets toe aan de lijst van ingehouden toetsen
                await keyboard.pressKey(key); // Druk de toets in op de computer
            }
            if (isRelease && heldKeys.has(key)) { // Als het een loslaat is én de toets wordt ingehouden...
                heldKeys.delete(key); // Verwijder de toets uit de lijst van ingehouden toetsen
                await keyboard.releaseKey(key); // Laat de toets los op de computer
            }
        }

        wss.clients.forEach((client) => { // Stuur een bevestiging terug naar alle verbonden clients
            if (client.readyState === WebSocket.OPEN) { // Alleen als de verbinding nog open is
                client.send(JSON.stringify({ response: button })); // Stuur terug welke knop verwerkt werd
            }
        });
    });

    ws.on('close', async () => { // Wanneer de telefoon de verbinding verbreekt...
        console.log('Client disconnected'); // Laat in de terminal zien dat iemand is losgekoppeld
        for (const key of heldKeys) await keyboard.releaseKey(key); // Laat alle nog-ingehouden toetsen los zodat ze niet blijven hangen
        heldKeys.clear(); // Leeg de lijst van ingehouden toetsen
    });
});

server.listen(8081, () => { // Start de server op poort 8081
    console.log('Server running on http://localhost:8081'); // Laat zien dat de server actief is
});