import say from 'say';
import config from './config.js';

export default (message) => {
  if (config["TD_SPEAK"]) {
    say.stop();
    if (process.platform === "darwin") {
      say.speak(message, "Fred", 1.2);
    } else {
      say.speak(message);
    }
  }
};
