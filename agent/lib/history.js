// the memory store
let store = [];
const { events, emitter } = require("../events");

module.exports = {
  // delete the memory store
  clear: () => {
    store.length = 0;
    emitter.emit(events.history.clear);
  },
  add: (entry) => {
    // make a copy of entry so it is immutable
    entry = JSON.parse(JSON.stringify(entry));

    // never store images in history
    entry.content = entry.content.filter((item) => {
      return item.type !== "image_url";
    });

    store.push(entry);
    emitter.emit(events.history.add, { entry, count: store.length });
  },
  get: () => {
    // make a copy of store so we don't modify the original
    return JSON.parse(JSON.stringify(store));
  },
  set: (l) => {
    store = l;
    emitter.emit(events.history.set, { count: store.length });
  },
  last: () => {
    return this.get().pop();
  },
};
