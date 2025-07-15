// the memory store
let store = [];

module.exports = {
  // delete the memory store
  clear: () => {
    store.length = 0;
  },
  add: (entry) => {
    // make a copy of entry so it is immutable
    entry = JSON.parse(JSON.stringify(entry));

    // never store images in history
    entry.content = entry.content.filter((item) => {
      return item.type !== "image_url";
    });

    store.push(entry);
  },
  get: () => {
    // make a copy of store so we don't modify the original
    return JSON.parse(JSON.stringify(store));
  },
  set: (l) => {
    store = l;
  },
  last: () => {
    return this.get().pop();
  },
};
