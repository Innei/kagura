FROM node:24-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV COREPACK_HOME=/pnpm/corepack
ENV PATH=$PNPM_HOME:$PATH

RUN mkdir -p "$COREPACK_HOME" \
  && corepack enable \
  && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/live-cli/package.json ./packages/live-cli/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

FROM base AS prod-deps

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

FROM base AS runtime

ENV NODE_ENV=production
ENV KAGURA_HOME=/app

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ripgrep \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system app \
  && useradd --system --gid app --create-home app

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/apps/kagura/package.json ./apps/kagura/package.json
COPY --from=build --chown=app:app /app/apps/kagura/dist ./apps/kagura/dist
COPY --from=build --chown=app:app /app/apps/kagura/node_modules ./apps/kagura/node_modules

RUN mkdir -p /app/data && chown -R app:app /app/data /pnpm && chmod 0777 /app/data

USER app

WORKDIR /app/apps/kagura

CMD ["node", "dist/index.js"]
