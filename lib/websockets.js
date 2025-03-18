const WebSocket = require('ws');

class WebSocketServerSingleton {
  constructor() {
    if (!WebSocketServerSingleton.instance) {
      this.wss = new WebSocket.Server({ port: 8080 }, () => {
      });

      this.clients = new Set();
      this.eventListeners = new Map();

      this.wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
      });

      this.wss.on('connection', (ws) => {

        console.log('Client connected');
        this.clients.add(ws);

        ws.on('message', (message) => {
          try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.event) {
              this.triggerEvent(parsedMessage.event, parsedMessage);
            } else {
              console.error('Parsed message does not contain an event property');
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        });

        ws.on('close', () => {
          this.clients.delete(ws);
          console.log('Client disconnected');
        });

        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
        });
      });

      WebSocketServerSingleton.instance = this;
    }

    return WebSocketServerSingleton.instance;
  }

  addEventListener(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(listener);
  }

  triggerEvent(event, data) {
    if (this.eventListeners.has(event)) {
      for (const listener of this.eventListeners.get(event)) {
        listener(data);
      }
    }
  }

  sendToClients(event, message) {
    const data = JSON.stringify({ event, message });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
}

const instance = new WebSocketServerSingleton();
Object.freeze(instance);

module.exports = instance;
