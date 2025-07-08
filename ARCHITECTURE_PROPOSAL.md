# Better Architecture Proposal

## Current Problem

- Global emitter shared between modules is messy
- Passing emitter to every function is not scalable
- Dependencies are tightly coupled

## Proposed Solution: Dependency Injection with Agent Context

### Pattern 1: Agent as Context (Recommended)

Make lib modules receive the agent instance and access emitter through it:

```javascript
// agent/lib/commands.js
class Commands {
  constructor(agent) {
    this.agent = agent;
    this.emitter = agent.emitter;
  }

  async click(x, y, action = "click") {
    this.emitter.emit(events.log.debug, `clicking at ${x}, ${y}`);
    // ... implementation
  }
}

// In TestDriverAgent constructor:
this.commands = new Commands(this);
```

### Pattern 2: Module Functions with Agent Parameter

For simpler modules, pass agent as first parameter:

```javascript
// agent/lib/system.js
const captureScreen = async (agent) => {
  agent.emitter.emit(events.log.debug, "capturing screen");
  // ... implementation
};

module.exports = { captureScreen };
```

### Pattern 3: Service Registry Pattern

Create a service registry that all modules can access:

```javascript
// agent/lib/registry.js
class ServiceRegistry {
  static instance = null;

  static setAgent(agent) {
    this.instance = { agent, emitter: agent.emitter };
  }

  static getEmitter() {
    return this.instance?.emitter;
  }
}
```

## Recommendation

Use **Pattern 1** for complex modules (commands, sandbox, etc.)
Use **Pattern 2** for simple utility functions
