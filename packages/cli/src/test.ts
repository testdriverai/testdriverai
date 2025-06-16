import { defineCommand } from "citty";
import { consola } from "consola";
import { Monitor, Window } from "node-screenshots";
import fs from "node:fs/promises";

class CaptureTarget {
  private readonly target: Monitor | Window;

  constructor(target: Monitor | Window) {
    this.target = target;
  }

  async captureImage() {
    if (this.target instanceof Window) {
      console.info(
        "Capturing image of",
        this.target.appName,
        this.target.title,
      );
    }
    return this.target.captureImage();
  }
}

export default defineCommand({
  meta: { name: "test", description: "Run tests through Vitest" },
  args: {
    "--watch": {
      type: "boolean",
      description: "Watch for changes and rerun tests",
    },
  },
  async run() {
    const monitors = new Map<`${Monitor["id"]}`, Monitor>(
      Monitor.all().map((monitor) => [`${monitor.id}`, monitor]),
    );

    const windows = new Map<`${Window["id"]}`, Window>(
      Window.all()
        .filter((item) => {
          switch (true) {
            case !item.title:
            // Ignore System Windows
            case item.appName === "Control Center":
            case item.appName === "Dock":
            case item.appName === "Window Server":
            case item.appName === "Spotlight":
            // Ignore macOS Menu Bar apps
            case item.y === 0:
              return false;
          }

          return true;
        })
        .sort((a, b) => a.appName.localeCompare(b.appName))
        .map((item) => [`${item.id}`, item]),
    );

    const id = await consola.prompt("Select the surface you want to test", {
      default: monitors.entries().next().value[0],
      options: [
        ...Array.from(monitors.entries()).map(([id, item]) => ({
          label: `🖥️  Screen – ${item.width}x${item.height}`,
          value: id,
        })),
        ...Array.from(windows.entries()).map(([id, item]) => ({
          label: `🈸 ${item.appName} – ${item.title}`,
          value: id,
        })),
        {
          label: "🔄 Refresh...",
          value: "REFRESH",
        },
      ],
      required: true,
      type: "select",
    });

    if (!id) {
      throw new Error("Cancelling...");
    }

    if (id === "REFRESH") {
      return this.run();
    }

    const target = new CaptureTarget(monitors.get(id)! ?? windows.get(id)!);
    const image = await target.captureImage();
    const file = await fs.writeFile("test.png", await image.toPng());

    consola.error("TODO: Implement test command");
  },
});
