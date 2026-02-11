/**
 * Popup Loading - diffThreshold=0.1, cache=false
 */
import { popupLoadingTest } from "./z_flake-shared.mjs";

popupLoadingTest("diffThreshold=0.1, cache=false", {
  redraw: { enabled: true, diffThreshold: 0.1 },
  cache: false,
});
