// renderer.js
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const video = document.querySelector("video");

startButton.addEventListener("click", () => {
  navigator.mediaDevices
    .getDisplayMedia({
      audio: true,
      video: {
        width: 320,
        height: 240,
        frameRate: 30,
      },
    })
    .then((stream) => {
      video.srcObject = stream;
      video.onloadedmetadata = (e) => video.play();
    })
    .catch((e) => console.log(e));
});

stopButton.addEventListener("click", () => {
  video.pause();
});
