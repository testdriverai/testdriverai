import notifier from 'node-notifier';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (message) => {
  if (config["TD_NOTIFY"]) {
    return notifier.notify({
      title: "TestDriver.ai",
      message,
      timeout: 5,
      icon: path.join(__dirname, "images", "icon.png"),
      sound: false,
    });
  }
};
