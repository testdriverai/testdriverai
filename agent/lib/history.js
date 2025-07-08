// this stores the history of the bot's interactions in memory
const { logger } = require("../../interfaces/logger.js");

// the memory store
let store = [];

module.exports = {
  // delete the memory store
  clear: () => {
    logger.debug(`clearing history`);
    store.length = 0;
  },
  add: (entry) => {
    // make a copy of entry so it is immutable
    entry = JSON.parse(JSON.stringify(entry));

    // never store images in history
    entry.content = entry.content.filter((item) => {
      return item.type !== "image_url";
    });

    logger.debug(`adding to history: ${JSON.stringify(entry.content)}`);

    store.push(entry);
  },
  get: () => {
    // make a copy of store so we don't modify the original
    return JSON.parse(JSON.stringify(store));
  },
  set: (l) => {
    // overwrites history
    logger.debug(`set history`);
    store = l;
  },
  last: () => {
    return this.get().pop();
  },
};
