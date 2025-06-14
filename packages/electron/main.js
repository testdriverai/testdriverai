// main.js
const {
  app,
  BrowserWindow,
  desktopCapturer,
  session,
  systemPreferences,
} = require("electron");

app.whenReady().then(async () => {
  const mainWindow = new BrowserWindow();
  const status = systemPreferences.getMediaAccessStatus("screen");

  console.info("status");

  const sources = (
    await desktopCapturer.getSources({
      types: ["screen", "window"],
    })
  ).sort((a, b) => a.name.localeCompare(b.name));

  console.info(sources.map((source) => source.name));

  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
        // Grant access to the first screen found.
        callback({ video: sources[0], audio: "loopback" });
      });
      // If true, use the system picker if available.
      // Note: this is currently experimental. If the system picker
      // is available, it will be used and the media request handler
      // will not be invoked.
    },
    { useSystemPicker: true },
  );

  mainWindow.loadFile("index.html");
});
