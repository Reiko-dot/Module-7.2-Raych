const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8081 });

wss.on('connection', (ws) => {

  console.log('Client connected');

  ws.on('message', (raw) => {
    const data = JSON.parse(raw);
    console.log('Button pressed:', data.button); // add this

    let response;
    switch (data.button) {
      case 'red':
        response = 'You pressed Red!';
        break;
      case 'blue':
        response = 'You pressed Blue!';
        break;
      case 'yellow':
        response = 'You pressed Yellow!';
        break;
      case 'green':
        response = 'You pressed Green!';
        break;
      default:
        response = 'Unknown button';
        break;

    } 

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ response }));
      }
    });
  }); // closes ws.on('message')

}); // closes wss.on('connection')

console.log('Server running on ws://localhost:8081');