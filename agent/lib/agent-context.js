// Simple service locator pattern for agent emitter
let currentAgent = null;

const setCurrentAgent = (agent) => {
  currentAgent = agent;
};

const getEmitter = () => {
  if (!currentAgent) {
    throw new Error(
      "No agent has been set. Call setCurrentAgent(agent) first.",
    );
  }
  return currentAgent.emitter;
};

const getCurrentAgent = () => {
  if (!currentAgent) {
    throw new Error(
      "No agent has been set. Call setCurrentAgent(agent) first.",
    );
  }
  return currentAgent;
};

module.exports = {
  setCurrentAgent,
  getEmitter,
  getCurrentAgent,
};
