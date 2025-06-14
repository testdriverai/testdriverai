import { defineCommand } from "citty";
import { consola } from "consola";

export default defineCommand({
  meta: { name: "test", description: "Run tests through Vitest" },
  args: {
    "--watch": {
      type: "boolean",
      description: "Watch for changes and rerun tests",
    },
  },
  run: () => {
    consola.error("TODO: Implement test command");
  },
});
