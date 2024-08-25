const say = require('say');

module.exports = (message) => {
  
  if (process.env["TD_SPEAK"]) {
    say.stop();
    if (process.platform === 'darwin') {
      say.speak(message, 'Fred', 1.2);
    } else {
      say.speak(message);
    }
  }

}
