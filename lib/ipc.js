let { emitter } = require("./events");

process.on("connect", () => {
  broadcast("connect", {});
});

process.on("message", (raw) => {
  let { event, data } = JSON.parse(raw);
  emitter.emit(event, data);
});

let broadcast = (event, data) => {
  let d = {event, data};
  if (process && typeof process.send === "function") {
    process.send(d);
  }
}

module.exports = { broadcast, emitter };
