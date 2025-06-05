import { defineConfig } from "tsdown";

export default defineConfig({
  // https://tsdown.dev/options/dts#enabling-dts-generation
  dts: true,
  entry: ["./src"],
});
