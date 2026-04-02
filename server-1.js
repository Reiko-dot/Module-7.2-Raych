const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8081 });

wss.on('connection', (ws) => {

  console.log('Client connected');

  ws.on('message', (raw) => {
    const data = JSON.parse(raw);
    console.log('Button pressed:', data.button); // add this
    

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ response: data.button }));
      }
    });
  }); // closes ws.on('message')

}); // closes wss.on('connection')

console.log('Server running on ws://localhost:8081');