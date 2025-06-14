import { createMain } from "citty";

import pkg from "../package.json" with { type: "json" };

const { name, version, description } = pkg;

createMain({
  meta: { description, name: `npx ${name}@latest`, version },
  subCommands: {
    test: () => import("./test.ts").then((m) => m.default),
  },
})({});
