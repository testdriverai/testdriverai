// esbuild.config.js
const esbuild = require("esbuild");
const { copy } = require("esbuild-plugin-copy");
const path = require("path");

// Replace import.meta.url with the correct path for different modules
const importMetaUrlPlugin = {
  name: "import-meta-url",
  setup(build) {
    build.onLoad({ filter: /\.js$/ }, async (args) => {
      let contents = await require("fs").promises.readFile(args.path, "utf8");

      if (contents.includes("sharp.node")) {
        contents = contents.replace(
          "@img/sharp-wasm32/sharp.node",
          "build/sharp-win32-x64.node",
        );
      }

      // Replace for 'get-windows npm module'
      if (args.path.includes("get-windows")) {
        contents = contents.replace(
          /import\.meta\.url/g,
          '"file://" + __filename.replace("\\index.js", "") + "get-windows/lib/file.js"',
        );
      }

      // Replace for 'get-windows npm module'
      if (args.path.endsWith("robotjs\\index.js")) {
        contents = contents.replace("require", "req");
        contents = contents.replace(
          "./build/Release/robotjs.node",
          "./robotjs.node",
        );

        contents =
          `
          const req = require('module').createRequire('file://' + __filename);
        ` + contents;
      }

      contents = contents.replace(
        /import\.meta\.url/g,
        '"file://" + __filename + "/dummy"',
      );

      return { contents, loader: "js" };
    });
  },
};

esbuild
  .build({
    entryPoints: ["index.js"],
    outfile: "build/index.js",
    bundle: true,
    platform: "node",
    // packages: "external",

    // *.node modules will be bundled with exe
    external: [
      "*.node",
      "mac-screen-capture-permissions",
    ],
    loader: {
      ".html": "file",
    },

    plugins: [
      importMetaUrlPlugin,

      // testdriver ps1 files
      copy({
        resolveFrom: "cwd",
        assets: {
          from: ["lib/*.ps1"],
          to: ["./build"], // Copy it to the output directory
        },
      }),

      // Resources
      copy({
        resolveFrom: "cwd",
        assets: {
          from: ["./lib/resources/*"],
          to: ["./build/resources/"], // Copy it to the output directory
        },
      }),

      // robotjs
      copy({
        resolveFrom: "cwd",
        assets: {
          from: [
            "node_modules/robotjs/build/Release/robotjs.node",
            "node_modules/mac-screen-capture-permissions/build/Release/screencapturepermissions.node",
          ],
          // to: ["./build/build/Release/"],
          to: ["./build/"],
        },
      }),

      // get-windows
      copy({
        resolveFrom: "cwd",
        assets: {
          from: [
            "node_modules/get-windows/main",
            "node_modules/get-windows/package.json",
          ], // Path to your .node file
          to: ["./build/get-windows"],
        },
      }),
      copy({
        resolveFrom: "cwd",
        assets: {
          from: [
            "node_modules/get-windows/lib/binding/napi-9-win32-unknown-x64/*.node",
          ],
          to: ["./build/lib/binding/napi-9-win32-unknown-x64/*.node"],
        },
      }),

      // screenshot-desktop
      copy({
        resolveFrom: "cwd",
        assets: {
          from: [
            "node_modules/screenshot-desktop/lib/win32/*.bat",
            "node_modules/screenshot-desktop/lib/win32/app.manifest",
          ],
          to: ["./build"],
        },
      }),

      // sharp
      copy({
        resolveFrom: "cwd",
        assets: {
          from: ["node_modules/@img/sharp-win32-x64/lib/*"],
          to: ["./build/"],
        },
      }),

      // odiff-bin
      copy({
        resolveFrom: "cwd",
        assets: {
          from: ["node_modules/odiff-bin/bin/odiff.exe"],
          to: ["./build/bin"],
        },
      }),
    ],
  })
  .catch(() => process.exit(1));
