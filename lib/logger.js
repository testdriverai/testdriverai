// central logger for the bot
const winston = require('winston')
const DatadogWinston = require('datadog-winston')
const os = require("os");
const chalk = require('chalk');
const stripAnsi = require('@electerm/strip-ansi').default;
const package = require('../package.json');
const path = require('path');
const fs = require('fs');

// responsible for rendering ai markdown output
const {marked} = require('marked');
const {markedTerminal} = require('marked-terminal');

let depth = 0;
let setDepth = (d) => {
  depth = d - 1;
  if (depth < 0) {
    depth = 0;
  }
}

// marked is a markdown parser
// markedTerminal allows us to render markdown in CLI
marked.use(markedTerminal({
  width: 58, // 58 is the width of the terminal output on a 16" macbook pro
  reflowText: true,
  tab: 0
}));

const spaceChar = '    ';

const prettyMarkdown = (markdown) => {

  if (typeof markdown !== 'string') {
    log('error', 'prettyMarkdown requires a string');
    log('error', markdown)
    return;
  }

  let consoleOutput = marked.parse(markdown);

  // strip newlines at end of consoleOutput
  consoleOutput = consoleOutput.replace(/\n$/, ''); 
  consoleOutput = consoleOutput.replace(/^/gm, spaceChar);

  // note that this is logged 3 times:

  // datadog
  log('silly', consoleOutput);

  // user terminal
  console.log(consoleOutput)
}

const logger = winston.createLogger({
  transports: []
})


// simple match for aws instance i-*
if (os.hostname().indexOf('i-') == 0 || process.env["VERBOSE"] == 'true') {

  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
    level: 'silly'
  }));
  
}

const log = (level, message, indent = false) => {

  let m = message;
  
  if (indent) {
    m = spaceChar + message;
  }

  if (process.env["DEV"] || (level !== 'silly' && level !== 'debug')) {
    console.log(m);
  }

  if (typeof message === 'string' || message instanceof String) {
    message = stripAnsi(message);
  } else {
    message = JSON.stringify(message);
  }

  logger.log({
    level,
    message,
    version: package.version,
  });

}

let loggy = {
  log, setDepth, prettyMarkdown
}

module.exports = loggy;
