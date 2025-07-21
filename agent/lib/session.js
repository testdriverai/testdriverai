// Factory function to create session instance
function createSession() {
  let session = null;

  return {
    get: () => {
      return session;
    },
    set: (s) => {
      if (s && !session) {
        session = s;
      }
    },
  };
}

// Export both factory function and legacy static instance for backward compatibility
const staticSession = createSession();

module.exports = {
  createSession,
  // Legacy static exports for backward compatibility
  get: staticSession.get,
  set: staticSession.set,
};
