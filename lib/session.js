let session = null;

export default {
  get: () => {
    return session;
  },
  set: (s) => {
    if (s) {
      session = s;
    }
  },
};
