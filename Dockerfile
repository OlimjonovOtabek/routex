FROM node:lts-alpine AS build

WORKDIR /src

COPY . .

RUN npm install

RUN npm run build \
    # Step 2: Copy index.html to dist
    && cp src/index.html dist/index.html \
    # Step 3: Copy all .css files
    && cp src/*.css dist/ \
    # Step 4: Replace "main.ts" with "main.js" in the copied HTML
    && sed -i 's/\.ts/\.js/g' dist/index.html

FROM nginx:alpine AS runtime

WORKDIR /usr/share/nginx/html

COPY --from=build /src/dist /usr/share/nginx/html