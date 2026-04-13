FROM node:24-alpine AS base
RUN npm install -g pnpm@10
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/integrations-anthropic-ai/package.json ./lib/integrations-anthropic-ai/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/code-gen/package.json ./artifacts/code-gen/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
ENV BASE_PATH=/
ENV PORT=3000
ENV NODE_ENV=production
RUN pnpm --filter @workspace/api-server run build
RUN pnpm --filter @workspace/code-gen run build

FROM node:24-alpine AS api
RUN npm install -g pnpm@10
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY artifacts/api-server/package.json ./artifacts/api-server/
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]

FROM nginx:alpine AS frontend
COPY --from=builder /app/artifacts/code-gen/dist/public /usr/share/nginx/html
COPY deploy/nginx-frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
