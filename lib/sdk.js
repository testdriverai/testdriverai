// custom "sdk" for calling our API
const root = "http://api.testdriver.ai";
const chalk = require('chalk');
const axios = require('axios');
const session = require('./session')
const package = require('../package.json');
const version = package.version;

let token = null;

let outputError = (e) => {

  console.log(chalk.red(e.code || e.response.data.code))

  if (e.response) {
  
    console.log(chalk.red(e.response?.status), chalk.red(e.response?.statusText))
    if(e.response.data) { console.log(e.response.data) }
    if(e.response.data.message) { console.log(e.response.data.message) }
    if (e.response.data.problems) {
      console.log('-----')
      console.log(e.response.data.problems.join('\n'))
    }
  } 
}

let auth = async () => {
  
  // data.apiKey = process.env.DASHCAM_API_KEY; @todo add-auth

  if (!data.apiKey) {
    console.log(chalk.red('API key not found. Set DASHCAM_API_KEY in your environment.'));
    process.exit(1);
  }

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: [root, 'auth/exchange-api-key'].join('/'),
    headers: { 
      'Content-Type': 'application/json'
    },
    data
  };

  // this is a dashcam api url
  try {
    let res = await axios.request(config);
    token = res.data.token;
  } catch (e) { 
    outputError(e);
    process.exit(1);
  }

}

let req = async (path, data) => {

  // for each value of data, if it is empty remove it
  for (let key in data) {
    if (!data[key]) {
      delete data[key];
    }
  }

  data.session = session.get()?.id;
  data = JSON.stringify(data);

  let dataCopy = JSON.parse(data);
  delete dataCopy.image
  
  let url = [root, 'api', 'v' + version, 'testdriver', path].join('/');

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url,
    headers: { 
      'Content-Type': 'application/json',
      // 'Authorization': 'Bearer ' + token @todo add-auth
    },
    data
  };
  
  let response;
  let redirect = null
  try {
    response = await axios.request(config);
  } catch (e) {

    if (e.response?.status === 301) {
      config.url = root + e.response.data;
      redirect = config;
    } else {
      outputError(e);
    }

  }

  if (redirect) {
    response = await axios.request(redirect).catch(e => {
      outputError(e);
    });
  }

  if (!response) {
    return;
  } else {
    return response.data;
  }
}

module.exports = {req, auth};
