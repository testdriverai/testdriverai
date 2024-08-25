let session = null;

module.exports = {
  get: () => {
    return session;
  },
  set: (s) => {
    session = s;
  }
};
