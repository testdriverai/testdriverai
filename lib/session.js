let session = null;

module.exports = {
  get: () => {
    return session;
  },
  set: (s) => {
    if (s && !session) {
      session = s;
    }
  },
};
