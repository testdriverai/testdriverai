#!/bin/bash
# Because Cursor runs commands from `/`, we need a relative binary that executes within the scope of this project.
# Plus, since we want to use the `devbox` environment for consistency.

cd "$(dirname "$0")/../../.." && devbox run mcp