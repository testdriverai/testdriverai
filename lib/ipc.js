const { EventEmitter } = require("events");
const { events } = require("./events");

/**
 * @type {import('events').EventEmitter & {broadcast: (event: string, data: any) => void}}
 */
const server = new EventEmitter();

let interactive = false;
process.on("connect", () => {
  broadcast(events.interactive, interactive);
});

process.on("message", (raw) => {
  const { event, data } = JSON.parse(raw);
  server.emit(event, data);
});

const broadcast = (event, data) => {
  const d = { event, data };
  if (process && typeof process.send === "function") {
    if (event === events.interactive) {
      interactive = data;
    }
    process.send(d);
  }
};

server.broadcast = broadcast;

module.exports = server;
