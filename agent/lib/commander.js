// translates the yml into commands that can be executed by the system.
const generator = require("./generator");
const yaml = require("js-yaml");
const marky = require("marky");
const { createSDK } = require("./sdk");
const { events } = require("../events");

const createCommander = (
  emitter,
  commands,
  analytics,
  config,
  outputsInstance,
  sessionInstance,
) => {
  // Create SDK instance with emitter, config, and session
  const sdk = createSDK(emitter, config, sessionInstance);
  // replace all occurances of ${OUTPUT.ls} with outputs.get("ls") in every possible property of the `object`
  // this is a recursive function that will go through all the properties of the object
  const replaceOutputs = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === "object") {
        replaceOutputs(obj[key]);
      } else if (typeof obj[key] === "string") {
        obj[key] = obj[key].replace(/\${OUTPUT\.(.*?)}/g, (_, match) =>
          outputsInstance.get(match),
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
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(events.log.narration, `typing ${object.text}`);
          response = await commands.type(object.text, object.delay);
          break;
        case "press-keys":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(
            events.log.narration,
            `pressing keys: ${Array.isArray(object.keys) ? object.keys.join(", ") : object.keys}`,
          );
          response = await commands["press-keys"](object.keys);
          break;
        case "scroll":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(events.log.narration, `scrolling ${object.direction}`);
          response = await commands.scroll(
            object.direction,
            object.amount,
            object.method,
          );
          break;
        case "wait":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(
            events.log.narration,
            `waiting ${object.timeout} seconds`,
          );
          response = await commands.wait(object.timeout);
          break;
        case "click":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(events.log.narration, `${object.action}`);
          response = await commands["click"](object.x, object.y, object.action);
          break;
        case "hover":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(events.log.narration, `moving mouse`);
          response = await commands["hover"](object.x, object.y);
          break;
        case "drag":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          response = await commands["drag"](object.x, object.y);
          break;
        case "hover-text":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(
            events.log.narration,
            `searching for ${object.description}`,
          );
          response = await commands["hover-text"](
            object.text,
            object.description,
            object.action,
            object.method,
            object.timeout,
          );
          break;
        case "hover-image":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(
            events.log.narration,
            `searching for image of ${object.description}`,
          );
          response = await commands["hover-image"](
            object.description,
            object.action,
          );
          break;
        case "match-image":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(
            events.log.narration,
            `${object.action} image ${object.path}`,
          );
          response = await commands["match-image"](
            object.path,
            object.action,
            object.invert,
          );
          break;
        case "wait-for-image":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(
            events.log.narration,
            `waiting for ${object.description}`,
          );
          response = await commands["wait-for-image"](
            object.description,
            object.timeout,
            object.invert,
          );
          break;
        case "wait-for-text":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(events.log.narration, `waiting for ${object.text}`);
          copy.text = "*****";
          response = await commands["wait-for-text"](
            object.text,
            object.timeout,
            object.method,
            object.invert,
          );
          break;
        case "scroll-until-text":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(events.log.narration, `scrolling until ${object.text}`);
          copy.text = "*****";
          response = await commands["scroll-until-text"](
            object.text,
            object.direction,
            object.distance,
            object.textMatchMethod,
            object.method,
            object.invert,
          );
          break;
        case "scroll-until-image": {
          const needle = object.description || object.path;
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(events.log.narration, `scrolling until ${needle}`);
          response = await commands["scroll-until-image"](
            object.description,
            object.direction,
            object.distance,
            object.method,
            object.path,
            object.invert,
          );
          break;
        }
        case "focus-application":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(events.log.narration, `focusing ${object.name}`);
          response = await commands["focus-application"](object.name);
          break;
        case "remember": {
          emitter.emit(events.log.log, generator.jsonToManual(object));
          let value = await commands["remember"](object.description);
          emitter.emit(events.log.log, value);
          outputsInstance.set(object.output, value);
          break;
        }
        case "assert":
          emitter.emit(events.log.log, generator.jsonToManual(object));
          emitter.emit(events.log.narration, `asserting ${object.expect}`);
          response = await commands.assert(
            object.expect,
            object.async,
            object.invert,
          );

          break;
        case "exec":
          emitter.emit(
            events.log.log,
            generator.jsonToManual({
              command: object.command,
              code:
                object.code.length > 100
                  ? object.code.slice(0, 100) + "..."
                  : object.code,
              lang: object.lang,
            }),
          );

          response = await commands.exec(
            object.lang,
            object.code,
            object.timeout || 60 * 3 * 1000,
          );

          outputsInstance.set(object.output, response);

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
