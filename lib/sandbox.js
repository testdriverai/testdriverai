const { Sandbox } = require('@e2b/desktop')

let desktop;
let url;

let boot = async () => {
  // Basic initialization
  if (desktop) {
    return desktop;
  } else {
    console.log('making new desktop')
    desktop = await Sandbox.create({
      resolution: [1024, 768],
    })
  }
  
  return desktop;
}

let stream = async () => {
  
  // Start the stream
  await desktop.stream.start()

  // Get stream URL
  url = desktop.stream.getUrl()

  return url;

}

let getDesktop = () => {
  return desktop;
}

module.exports = {
  stream,
  boot,
  getDesktop
};
