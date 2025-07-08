// translates the yml into commands that can be executed by the system.
const { commands } = require("./commands");
const generator = require("./generator");
const yaml = require("js-yaml");
const analytics = require("./analytics");
const marky = require("marky");
const sdk = require("./sdk");
const outputs = require("./outputs");
const { emitter, events } = require("../events");

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
    throw `YML is formatted improperly. 
  
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
\`\`\``;
  } else {
    replaceOutputs(object);

    let copy = JSON.parse(JSON.stringify(object));

    marky.mark(object.command);

    // we speak, log, and take images here because we want to be careful not to render a notification containing the text we're looking for
    // or to cover the screen of some item we might want

    // this will actually interpret the command and execute it
    switch (object.command) {
      case "type":
        emitter.emit(events.status, `typing ${object.text}`);
        emitter.emit(events.log.info, generator.jsonToManual(object));
        response = await commands.type(object.text, object.delay);
        break;
      case "press-keys":
        emitter.emit(events.status, `pressing keys ${object.keys.join(",")}`);
        emitter.emit(events.log.info, generator.jsonToManual(object));
        response = await commands["press-keys"](object.keys);
        break;
      case "scroll":
        emitter.emit(events.status, `scrolling ${object.direction}`);
        emitter.emit(events.log.info, generator.jsonToManual(object));
        response = await commands.scroll(
          object.direction,
          object.amount,
          object.method,
        );
        break;
      case "wait":
        emitter.emit(events.status, `waiting ${object.timeout} seconds`);
        emitter.emit(events.log.info, generator.jsonToManual(object));
        response = await commands.wait(object.timeout);
        break;
      case "click":
        emitter.emit(events.status, `${object.action}`);
        emitter.emit(events.log.info, generator.jsonToManual(object));
        response = await commands["click"](object.x, object.y, object.action);
        break;
      case "hover":
        emitter.emit(events.status, `moving mouse`);
        emitter.emit(events.log.info, generator.jsonToManual(object));
        response = await commands["hover"](object.x, object.y);
        break;
      case "drag":
        emitter.emit(events.log.info, generator.jsonToManual(object));
        response = await commands["drag"](object.x, object.y);
        break;
      case "hover-text":
        emitter.emit(events.status, `searching for ${object.description}`);
        emitter.emit(events.log.info, generator.jsonToManual(object));
        response = await commands["hover-text"](
          object.text,
          object.description,
          object.action,
          object.method,
        );
        break;
      case "hover-image":
        emitter.emit(
          events.status,
          `searching for image of ${object.description}`,
        );
        emitter.emit(events.log.info, generator.jsonToManual(object));
        response = await commands["hover-image"](
          object.description,
          object.action,
        );
        break;
      case "match-image":
        emitter.emit(events.log.info, generator.jsonToManual(object));
        emitter.emit(events.status, `${object.action} image ${object.path}`);
        response = await commands["match-image"](object.path, object.action);
        break;
      case "wait-for-image":
        emitter.emit(events.status, `waiting for ${object.description}`);
        emitter.emit(events.log.info, generator.jsonToManual(object));
        response = await commands["wait-for-image"](
          object.description,
          object.timeout,
        );
        break;
      case "wait-for-text":
        emitter.emit(events.status, `waiting for ${object.text}`);
        emitter.emit(events.log.info, generator.jsonToManual(object));
        copy.text = "*****";
        response = await commands["wait-for-text"](
          object.text,
          object.timeout,
          object.method,
        );
        break;
      case "scroll-until-text":
        emitter.emit(events.status, `scrolling until ${object.text}`);
        emitter.emit(events.log.info, generator.jsonToManual(object));
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
        emitter.emit(events.status, `scrolling until ${needle}`);
        emitter.emit(events.log.info, generator.jsonToManual(object));
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
        emitter.emit(events.status, `focusing ${object.name}`);
        emitter.emit(events.log.info, generator.jsonToManual(object));
        response = await commands["focus-application"](object.name);
        break;
      case "remember": {
        emitter.emit(events.log.info, generator.jsonToManual(object));
        let value = await commands["remember"](object.description);
        emitter.emit(events.log.info, value);
        outputs.set(object.output, value);
        break;
      }
      case "assert":
        emitter.emit(events.status, `asserting ${object.expect}`);
        emitter.emit(events.log.info, generator.jsonToManual(object));
        response = await commands.assert(object.expect, object.async);
        break;
      case "exec":
        emitter.emit(events.status, `exec`);
        emitter.emit(events.log.info, generator.jsonToManual(object));

        response = await commands.exec(object.lang, object.code);

        outputs.set(object.output, response);

        break;
      default:
        throw new Error(`Command not found: ${object.command}`);
    }
  }

  let timing = marky.stop(object.command);

  await Promise.all([
    sdk.req("ran", { command: object.command, data: object }),
    analytics.track("command", { data: object, depth, timing }),
  ]);

  return response;
};

module.exports = { run };
