const EventEmitter = require('events');
const WebSocket = require('ws');
const config = require('./config');

class Sandbox {
  constructor() {
    this.socket = null;
    this.ps = {};
  }

  send(message) {
    let resolvePromise;
    if (this.socket) {
      message.requestId = Math.random().toString(36).substring(7) + new Date().getTime();
      let p = new Promise((resolve, reject) => {
        this.socket.send(JSON.stringify(message));
        resolvePromise = resolve;
      });
      this.ps[message.requestId] = {promise: p, resolve: resolvePromise};
      return p;
    }
  }

  async boot() {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket('ws://localhost:8081');

      this.socket.on('open', async () => {
        resolve(this);
      });

      this.socket.on('message', (raw) => {
        let message = JSON.parse(raw);

        if (this.ps[message.requestId]) {
          this.ps[message.requestId].resolve(message);
          delete this.ps[message.requestId];
        } else {
          console.log('unhandled message', message);
        }
      });

      this.socket.on('close', () => {
        console.log('Disconnected from server. Check your API Key (`TD_API_KEY`).');
        reject();
      });
    });
  }
}

const sandboxInstance = new Sandbox();
module.exports = sandboxInstance;
