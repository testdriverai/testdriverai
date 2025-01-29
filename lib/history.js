// this stores the history of the bot's interactions in memory
import { log } from './logger.js';

// the memory store
let store = [];

// Helper function for getting the last item
const getLast = () => {
  return getAll().pop();
};

// Helper function for getting all items
const getAll = () => {
  // make a copy of store so we don't modify the original
  return JSON.parse(JSON.stringify(store));
};

export default {
  // delete the memory store
  clear: () => {
    log("debug", `clearing history`);
    store.length = 0;
  },
  add: (entry) => {
    // make a copy of entry so it is immutable
    entry = JSON.parse(JSON.stringify(entry));

    // never store images in history
    entry.content = entry.content.filter((item) => {
      return item.type !== "image_url";
    });

    log("debug", `adding to history: ${JSON.stringify(entry.content)}`);

    store.push(entry);
  },
  get: getAll,
  set: (l) => {
    // overwrites history
    log("debug", `set history`);
    store = l;
  },
  last: getLast,
};
