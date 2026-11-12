FROM node:24-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g bun@1.4.4
WORKDIR /app

FROM base AS build
ARG BYTEPANEL_COMMIT_SHA=""
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV BYTEPANEL_COMMIT_SHA=$BYTEPANEL_COMMIT_SHA
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build bun install --frozen-lockfile
RUN cd apps/web \
  && DATABASE_URL=postgresql://build:build@localhost:5432/build \
     BETTER_AUTH_SECRET=build-time-placeholder-not-a-real-secret \
     BETTER_AUTH_URL=http://localhost:3000 \
     bun run build

FROM base AS panel
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build --chown=node:node /app /app
USER node
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["sh", "-c", "bunx --bun prisma migrate deploy && exec bun run start"]
