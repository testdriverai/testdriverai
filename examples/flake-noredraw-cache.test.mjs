/**
 * Popup Loading - redraw=false, cache=true
 */
import { popupLoadingTest } from "./flake-shared.mjs";

popupLoadingTest("redraw=false, cache=true", {
  redraw: { enabled: false },
  cache: true,
});
