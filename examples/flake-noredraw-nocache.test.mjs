/**
 * Popup Loading - redraw=false, cache=false
 */
import { popupLoadingTest } from "./flake-shared.mjs";

popupLoadingTest("redraw=false, cache=false", {
  redraw: { enabled: false },
  cache: false,
});
