FROM node:lts-alpine AS build

WORKDIR /src

COPY . .

RUN npm install

RUN ./build.sh

FROM nginx:alpine AS runtime

WORKDIR /usr/share/nginx/html

COPY --from=build /src/dist /usr/share/nginx/html