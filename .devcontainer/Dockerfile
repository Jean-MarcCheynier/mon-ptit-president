FROM mcr.microsoft.com/devcontainers/javascript-node:24

# pnpm version comes from "packageManager" in the root package.json.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Claude Code config dir lives on a named volume (see compose.yml); make sure
# the non-root user owns the mount point so the volume inherits it.
RUN mkdir -p /home/node/.claude && chown -R node:node /home/node/.claude
