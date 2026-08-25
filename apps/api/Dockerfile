# syntax=docker/dockerfile:1

# ── Rust PDF→WebP rasterizer (PDFium) ─────────────────────────────
FROM rust:1.88-bookworm AS rust-build
WORKDIR /src
COPY apps/api/native/magazine-pages-raster/ ./
RUN cargo build --release
# Must match pdfium-render feature pdfium_7543 in native/magazine-pages-raster/Cargo.toml
ARG PDFIUM_RELEASE=chromium%2F7543
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -fsSL -o /tmp/pdfium.tgz \
    "https://github.com/bblanchon/pdfium-binaries/releases/download/${PDFIUM_RELEASE}/pdfium-linux-x64.tgz" \
  && mkdir -p /opt/pdfium \
  && tar -xzf /tmp/pdfium.tgz -C /opt/pdfium \
  && test -f /opt/pdfium/lib/libpdfium.so \
  && rm -rf /var/lib/apt/lists/*

# ── Node deps / build ─────────────────────────────────────────────
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --filter @studrc/api... --frozen-lockfile

FROM base AS build
COPY --from=deps /app /app
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN pnpm exec prisma generate && pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# sharp needs libvips; cairo still useful for pdfjs fallback
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libvips42 \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    libpixman-1-0 \
    ffmpeg \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r nodejs && useradd -r -g nodejs nestjs

COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules

# Rust rasterizer + PDFium shared lib
COPY --from=rust-build /src/target/release/magazine-pages-raster /usr/local/bin/magazine-pages-raster
COPY --from=rust-build /opt/pdfium/lib/libpdfium.so /usr/local/lib/libpdfium.so
RUN ldconfig \
  && chown nestjs:nodejs /usr/local/bin/magazine-pages-raster

ENV LD_LIBRARY_PATH=/usr/local/lib
ENV MAGAZINE_PAGES_RASTER_BIN=/usr/local/bin/magazine-pages-raster
ENV MAGAZINE_PAGES_RASTERIZER=rust
ENV PDFIUM_DIR=/usr/local/lib

USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]
