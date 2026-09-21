# Hosted TestDriver MCP server (Streamable HTTP + Auth0 OAuth).
#
# Build context is the repo root. The server is not self-contained: at runtime
# it reads ../../package.json (the SDK version), imports ../../../sdk.js when a
# session starts, and ../../lib/init-project.js for the init tool. So the image
# keeps the SDK layout intact (/app/sdk/mcp-server inside /app/sdk) and installs
# both the SDK's and the MCP server's production dependencies.

FROM node:22-alpine AS builder

WORKDIR /app/sdk/mcp-server

COPY sdk/mcp-server/package*.json ./
RUN npm ci --ignore-scripts

COPY sdk/mcp-server/ ./
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app/sdk
COPY sdk/package*.json ./
RUN npm ci --ignore-scripts --omit=dev

WORKDIR /app/sdk/mcp-server
COPY sdk/mcp-server/package*.json ./
RUN npm ci --ignore-scripts --omit=dev

WORKDIR /app/sdk
COPY sdk/ ./
COPY --from=builder /app/sdk/mcp-server/dist ./mcp-server/dist

WORKDIR /app/sdk/mcp-server

ENV NODE_ENV=production
ENV PORT=8080
ENV TD_MCP_TRANSPORT=http
ENV TD_MCP_AUTH=oauth
ENV TD_MCP_HOST=0.0.0.0

EXPOSE 8080

CMD ["node", "dist/server.mjs"]
