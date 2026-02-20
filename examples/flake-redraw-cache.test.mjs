/**
 * Popup Loading - redraw=true, cache=true
 */
import { popupLoadingTest } from "./flake-shared.mjs";

popupLoadingTest("redraw=true, cache=true", {
  redraw: { enabled: true },
  cache: true,
});
