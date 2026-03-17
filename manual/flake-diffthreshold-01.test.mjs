/**
 * Popup Loading - diffThreshold=0.1, cache=false
 */
import { popupLoadingTest } from "./flake-shared.mjs";

popupLoadingTest("screen=0.1, cache=false", {
  redraw: { enabled: true, thresholds: { screen: 0.1 } },
  cache: false,
});
