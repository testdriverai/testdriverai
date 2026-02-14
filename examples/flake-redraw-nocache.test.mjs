/**
 * Popup Loading - redraw=true, cache=false
 */
import { popupLoadingTest } from "./flake-shared.mjs";

popupLoadingTest("redraw=true, cache=false", {
  redraw: { enabled: true },
  cache: false,
});
