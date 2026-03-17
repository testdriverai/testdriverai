/**
 * Popup Loading - diffThreshold=0.5, cache=true
 */
import { popupLoadingTest } from "./flake-shared.mjs";

popupLoadingTest("screen=0.5, cache=true", {
  redraw: { enabled: true, thresholds: { screen: 0.5 } },
  cache: true,
});
