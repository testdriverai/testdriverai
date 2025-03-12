### Instructions for building the binary

#### Bundling with esbuild
Before building the binary, we first need to bundle the source into a single file with `esbuild`.

We have an esbuild build script ready for this.

We are currently using Node `v20.11.1` as the build target.
Ensure that you are also using this exact version locally.

Currently tested on:
- Mac Os 14.4.1 - M1 / arm64 ???
- Linux x64 ???
- Windows ??????

```sh
node build.mjs
```

This will provide a single bundle file `entry.js` with all the dependencies included.

You can try running the generated file with:
```sh
node entrypoint.js
```

This is the file we need for the next step

### Building binary with pkg

We use this pkg fork: https://github.com/yao-pkg/pkg to build the binary.

Ensure it is installed globally:
```sh
npm install -g @yao-pkg/pkg
```

For Mac, the config file is `pkg.config-macos-arm64.json` and for linux it is 
`pkg.config-linux-x64.json`

To build the binary from entry.js for Mac:

```sh
npm run build-mac-dev
```

and for linux:

```sh
npm run build-linux-dev
```

This produces a binary named `entry` in the current directory.

To run the binary:

```sh
./entrypoint
```

To run the binary in debugging mode, showing all the files that have been included
in the virtual filesystem:

```sh
DEBUG_PKG=1 ./entrypoint
```

### Linux build specifics

Ensure the required packages are installed:
```sh
sudo apt install libvips libxtst-dev libpng++-dev libglib2.0-dev
```

For the native bindings to be built on linux we need sharp version "0.3.26" 
and not the latest "0.33.3"

Other issues to take note of regarding "sharp" on linux:
- https://github.com/lovell/sharp/issues/3870
- https://github.com/npm/cli/issues/4828#issuecomment-2077092392

### Windows

Ensure you have the tools required to build native packages:
https://github.com/nodejs/node-gyp?tab=readme-ov-file#on-windows

Configure npm to point to the latest version of MS build tools

Run the following command to open the npm config file:

```sh
npm config edit
```

Ensure you have this line in your config:
`msvs_version=2022`

And now you should be able to install `robotjs`

### Problems with `sharp` on Windows

Install the top level node modules first.

Navigate to the `sharp` install location and build the binary

```sh
cd node_modules/sharp
node-gyp configure
node-gyp build
```
