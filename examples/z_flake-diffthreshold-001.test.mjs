/**
 * Popup Loading - diffThreshold=0.01, cache=true
 */
import { popupLoadingTest } from "./z_flake-shared.mjs";

popupLoadingTest("diffThreshold=0.01, cache=true", {
  redraw: { enabled: true, diffThreshold: 0.01 },
  cache: true,
});
