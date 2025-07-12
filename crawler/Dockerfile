FROM oven/bun:1 AS base
WORKDIR /usr/src/app

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
  apt-get upgrade -qq -y && \
  apt-get install -qq -y nano htop cifs-utils bash wget bzip2 curl procps cron
  
# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
RUN mkdir -p /home/bun/data/logs /home/bun/data/archive /home/bun/data/config /home/bun/.ssh/config.d

# build for production
ARG HOME=/home/bun
ENV NODE_ENV=production
RUN DATA_ROOT=/home/bun/data \
  bun run build

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease \
  /usr/src/app/build \
  /usr/src/app/package.json \
  ./

RUN mkdir -p /home/bun/data/logs /home/bun/data/archive /home/bun/data/config
RUN chown -R bun:bun /home/bun/data

USER bun

ENV SOCKET_PATH="/home/bun/config/api.sock"

ENTRYPOINT [ "bun", "--bun", "index.js" ]
#CMD ["-c", "/home/bun/data/config/wrkr-01.json"]