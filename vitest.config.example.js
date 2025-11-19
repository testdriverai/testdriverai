import { defineConfig } from "vitest/config";
import testDriverPlugin from "./interfaces/vitest-plugin.mjs";

export default defineConfig({
  plugins: [
    testDriverPlugin({
      apiKey: process.env.TD_API_KEY,
      apiRoot: process.env.TD_API_ROOT || "https://testdriver-api.onrender.com",
    }),
  ],

  test: {
    // Optional: Configure test timeout
    testTimeout: 30000,

    // Optional: Configure hooks timeout
    hookTimeout: 30000,
  },
});
