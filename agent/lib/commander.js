// translates the yml into commands that can be executed by the system.
const generator = require("./generator");
const yaml = require("js-yaml");
const marky = require("marky");
const { createSDK } = require("./sdk");
const outputs = require("./outputs");
const { events } = require("../events");

const createCommander = (emitter, commands, analytics) => {
  // Create SDK instance with emitter
  const sdk = createSDK(emitter);
  // replace all occurances of ${OUTPUT.ls} with outputs.get("ls") in every possible property of the `object`
  // this is a recursive function that will go through all the properties of the object
  const replaceOutputs = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === "object") {
        replaceOutputs(obj[key]);
      } else if (typeof obj[key] === "string") {
        obj[key] = obj[key].replace(/\${OUTPUT\.(.*?)}/g, (_, match) =>
          outputs.get(match),
        );
      }
    }
  };

  // object is a json representation of the individual yml command
  // the process turns markdown -> yml -> json -> js function execution
  const run = async (object, depth) => {
    // success returns null
    // if this is set, it means that we need to take more action and a new thread is spawned
    let response = null;

    if (!object?.command) {
      // Enhanced error with potential location info
      const error = new Error(`YML is formatted improperly. 
  
The input YML is:
${yaml.dump(object)}

Our test structure is in YAML format. 

- Each step is an object with a key of \`commands\` and a value of an array of commands. 
- Each command is an object with a key of \`command\` and a value of the command to run.

Here is a simple example:

\`\`\`yaml
commands:
  - command: press-keys
    keys: [command, space]
\`\`\``);

      error.yamlObject = object;
      throw error;
    } else {
      replaceOutputs(object);

      let copy = JSON.parse(JSON.stringify(object));

      marky.mark(object.command);

      // Emit command status event
      emitter.emit(events.command.status, {
        command: object.command,
        status: "executing",
        data: object,
        depth,
        timestamp: Date.now(),
      });

      // we speak, log, and take images here because we want to be careful not to render a notification containing the text we're looking for
      // or to cover the screen of some item we might want

      // this will actually interpret the command and execute it
      switch (object.command) {
        case "type":
          emitter.emit(events.narration, `typing ${object.text}`);
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands.type(object.text, object.delay);
          break;
        case "press-keys":
          emitter.emit(
            events.narration,
            `pressing keys ${object.keys.join(",")}`,
          );
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands["press-keys"](object.keys);
          break;
        case "scroll":
          emitter.emit(events.narration, `scrolling ${object.direction}`);
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands.scroll(
            object.direction,
            object.amount,
            object.method,
          );
          break;
        case "wait":
          emitter.emit(events.narration, `waiting ${object.timeout} seconds`);
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands.wait(object.timeout);
          break;
        case "click":
          emitter.emit(events.narration, `${object.action}`);
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands["click"](object.x, object.y, object.action);
          break;
        case "hover":
          emitter.emit(events.narration, `moving mouse`);
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands["hover"](object.x, object.y);
          break;
        case "drag":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands["drag"](object.x, object.y);
          break;
        case "hover-text":
          emitter.emit(events.narration, `searching for ${object.description}`);
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands["hover-text"](
            object.text,
            object.description,
            object.action,
            object.method,
          );
          break;
        case "hover-image":
          emitter.emit(
            events.narration,
            `searching for image of ${object.description}`,
          );
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands["hover-image"](
            object.description,
            object.action,
          );
          break;
        case "match-image":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(
            events.narration,
            `${object.action} image ${object.path}`,
          );
          response = await commands["match-image"](object.path, object.action);
          break;
        case "wait-for-image":
          emitter.emit(events.narration, `waiting for ${object.description}`);
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands["wait-for-image"](
            object.description,
            object.timeout,
          );
          break;
        case "wait-for-text":
          emitter.emit(events.narration, `waiting for ${object.text}`);
          emitter.emit(events.log.log, generator.jsonToManual(object));
          copy.text = "*****";
          response = await commands["wait-for-text"](
            object.text,
            object.timeout,
            object.method,
          );
          break;
        case "scroll-until-text":
          emitter.emit(events.narration, `scrolling until ${object.text}`);
          emitter.emit(events.log.log, generator.jsonToManual(object));
          copy.text = "*****";
          response = await commands["scroll-until-text"](
            object.text,
            object.direction,
            object.distance,
            object.textMatchMethod,
            object.method,
          );
          break;
        case "scroll-until-image": {
          const needle = object.description || object.path;
          emitter.emit(events.narration, `scrolling until ${needle}`);
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands["scroll-until-image"](
            object.description,
            object.direction,
            object.distance,
            object.method,
            object.path,
          );
          break;
        }
        case "focus-application":
          emitter.emit(events.narration, `focusing ${object.name}`);
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands["focus-application"](object.name);
          break;
        case "remember": {
          emitter.emit(events.log.log, generator.jsonToManual(object));
          let value = await commands["remember"](object.description);
          emitter.emit(events.log.log, value);
          outputs.set(object.output, value);
          break;
        }
        case "assert":
          emitter.emit(events.narration, `asserting ${object.expect}`);
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands.assert(object.expect, object.async);
          break;
        case "exec":
          emitter.emit(events.narration, `exec`);
          emitter.emit(events.log.log, generator.jsonToManual(object));

          response = await commands.exec(object.lang, object.code);

          outputs.set(object.output, response);

          break;
        default: {
          const error = new Error(`Command not found: ${object.command}`);
          error.yamlObject = object;
          throw error;
        }
      }
    }

    let timing = marky.stop(object.command);

    // Emit command progress event
    emitter.emit(events.command.progress, {
      command: object.command,
      status: "completed",
      timing: timing.duration,
      data: object,
      depth,
      timestamp: Date.now(),
    });

    await Promise.all([
      sdk.req("ran", { command: object.command, data: object }),
      analytics.track("command", { data: object, depth, timing }),
    ]);

    return response;
  };

  return { run };
};

module.exports = { createCommander };
