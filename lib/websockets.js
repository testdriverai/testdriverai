const WebSocket = require('ws');
// Start a WebSocket server
const wss = new WebSocket.Server({ port: 8080 }, () => {
  console.log('WebSocket server is listening on port 8080');
});

const clients = new Set();
const eventListeners = new Map();

function addEventListener(event, listener) {

  if (!eventListeners.has(event)) {
    eventListeners.set(event, []);
  }
  eventListeners.get(event).push(listener);
}

function triggerEvent(event, data) {

  console.log(event, data)

  if (eventListeners.has(event)) {
    for (const listener of eventListeners.get(event)) {
      listener(data);
    }
  }
}
wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);

  ws.on('message', (message) => {
    console.log('Received message from client:', message);
    try {
      const parsedMessage = JSON.parse(message);
      console.log('Parsed message:', parsedMessage);
      if (parsedMessage.event) {
        triggerEvent(parsedMessage.event, parsedMessage);
      } else {
        console.error('Parsed message does not contain an event property');
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function sendToClients(event, message) {
  const data = JSON.stringify({ event, message });
  for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
          client.send(data);
      }
  }
}

module.exports = { sendToClients, addEventListener };
