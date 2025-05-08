// translates the yml into commands that can be executed by the system.
const { commands } = require("./commands");
const { logger } = require("./logger");
const generator = require("./generator");
const yaml = require("js-yaml");
const speak = require("./speak");
const notify = require("./notify");
const analytics = require("./analytics");
const marky = require("marky");
const sdk = require("./sdk");
const outputs = require("./outputs");
const server = require("./ipc");

// replace all occurances of ${OUTPUT.ls} with outputs.get("ls") in every possible property of the `object` 
// this is a recursive function that will go through all the properties of the object
const replaceOutputs = (obj) => {

  for (let key in obj) {

    if (typeof obj[key] === "object") {
      replaceOutputs(obj[key]);
    } else if (typeof obj[key] === "string") {
      obj[key] = obj[key].replace(/\${OUTPUT\.(.*?)}/g, (_, match) => outputs.get(match));
    }
  }
};

// object is a json representation of the individual yml command
// the process turns markdown -> yml -> json -> js function execution
const run = async (object, depth) => {

try {

  logger.debug("%j", { object, depth });

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
        speak(`typing ${object.text}`);
        server.broadcast("status", `typing ${object.text}`);
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));
        response = await commands.type(object.text, object.delay);
        break;
      case "press-keys":
        speak(`pressing keys ${object.keys.join(",")}`);
        server.broadcast("status", `pressing keys ${object.keys.join(",")}`);
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));
        response = await commands["press-keys"](object.keys);
        break;
      case "scroll":
        speak(`scrolling ${object.direction}`);
        server.broadcast("status", `scrolling ${object.direction}`);
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));
        response = await commands.scroll(
          object.direction,
          object.amount,
          object.method,
        );
        break;
      case "wait":
        speak(`waiting ${object.timeout} seconds`);
        server.broadcast("status", `waiting ${object.timeout} seconds`);
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));
        response = await commands.wait(object.timeout);
        break;
      case "click":
        speak(`${object.action}`);
        server.broadcast("status", `${object.action}`);
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));
        response = await commands["click"](
          object.x,
          object.y,
          object.action,
        );
        break;
      case "hover":
        speak(`moving mouse`);
        server.broadcast("status", `moving mouse`);
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));
        response = await commands["hover"](object.x, object.y);
        break;
      case "drag":
        speak(`dragging mouse`);
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));
        response = await commands["drag"](object.x, object.y);
        break;
      case "hover-text":
        speak(`searching for ${object.description}`);
        server.broadcast("status", `searching for ${object.description}`);
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));
        response = await commands["hover-text"](
          object.text,
          object.description,
          object.action,
          object.method,
        );
        break;
      case "hover-image":
        speak(`searching for image of ${object.description}`);
        server.broadcast("status", `searching for image of ${object.description}`);
        logger.info(generator.jsonToManual(object));
        response = await commands["hover-image"](
          object.description,
          object.action,
        );
        break;
      case "match-image":
        logger.info(generator.jsonToManual(object));
        server.broadcast("status", `${object.action} image ${object.path}`);
        notify(generator.jsonToManual(object, false));
        response = await commands["match-image"](
          object.path,
          object.action
        );
        break;
      case "wait-for-image":
        speak(`waiting for ${object.description}`);
        server.broadcast("status", `waiting for ${object.description}`);
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));
        response = await commands["wait-for-image"](
          object.description,
          object.timeout,
        );
        break;
      case "wait-for-text":
        speak(`waiting for ${object.text}`);
        server.broadcast("status", `waiting for ${object.text}`);
        logger.info(generator.jsonToManual(object));
        copy.text = "*****";
        notify(generator.jsonToManual(copy, false));
        response = await commands["wait-for-text"](
          object.text,
          object.timeout,
          object.method,
        );
        break;
      case "scroll-until-text":
        speak(`scrolling until ${object.text}`);
        server.broadcast("status", `scrolling until ${object.text}`);
        logger.info(generator.jsonToManual(object));
        copy.text = "*****";
        notify(generator.jsonToManual(copy, false));
        response = await commands["scroll-until-text"](
          object.text,
          object.direction,
          object.distance,
          object.textMatchMethod,
          object.method,
        );
        break;
      case "scroll-until-image":
        speak(`scrolling until ${object.description}`);
        server.broadcast("status", `scrolling until ${object.description}`);
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));
        response = await commands["scroll-until-image"](
          object.description,
          object.direction,
          object.distance,
          object.method,
        );
        break;
      case "focus-application":
        speak(`focusing ${object.name}`);
        server.broadcast("status", `focusing ${object.name}`);
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));
        response = await commands["focus-application"](object.name);
        break;
      case "remember":
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));
        response = await commands["remember"](object.description, object.value);
        break;
      case "assert":
        speak(`asserting ${object.expect}`);
        server.broadcast("status", `asserting ${object.expect}`);
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));
        response = await commands.assert(object.expect, object.async);
        break;
      case "exec":
        
        speak(`exec`);
        server.broadcast("status", `exec`);
        logger.info(generator.jsonToManual(object));
        notify(generator.jsonToManual(object, false));

        response = await commands.exec(object.lang, object.mac, object.windows, object.linux, object.silent);
        
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

} catch (error) {
  logger.debug(error);
  throw error;
}
}

module.exports = { run };
