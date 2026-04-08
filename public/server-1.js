const WebSocket = require('ws');
const robot = require('robotjs');
const wss = new WebSocket.Server({ port: 8081 });

wss.on('connection', (ws) => {

  console.log('Client connected');

  ws.on('message', (raw) => {
    const data = JSON.parse(raw);
    console.log('Button pressed:', data.button);

    if (data.button === 'up')       robot.keyTap('up');
    if (data.button === 'down')     robot.keyTap('down');
    if (data.button === 'left')     robot.keyTap('left');
    if (data.button === 'right')    robot.keyTap('right');
    if (data.button === 'letter-a') robot.keyTap('space');
    if (data.button === 'letter-b') robot.keyTap('b');
    if (data.button === 'letter-x') robot.keyTap('x');
    if (data.button === 'letter-y') robot.keyTap('y');
    if (data.button === 'esc')      robot.keyTap('escape');

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ response: data.button }));
      }
    });
  });

});

console.log('Server running on ws://localhost:8081');