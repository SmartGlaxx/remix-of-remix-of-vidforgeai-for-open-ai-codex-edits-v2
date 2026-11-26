FROM node:22-bookworm-slim AS bundle
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY src/components/explainer ./src/components/explainer
RUN ./node_modules/.bin/esbuild src/components/explainer/renderFilm.ts --bundle --global-name=Studio --outfile=/bundle.js
FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /worker
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/* && npm install playwright@1.56.1 @supabase/supabase-js@2
COPY --from=bundle /bundle.js .
COPY explainer-worker/worker.mjs .
CMD ["node","worker.mjs"]
