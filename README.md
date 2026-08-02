# HomeLab Dashboard

A small React + TypeScript + Vite dashboard for managing local home lab services.

It is designed to run through Docker Compose with a Vite frontend, an Express backend that saves the dashboard configuration, and optional Uptime Kuma integration.

## What this project does

- Loads a dashboard configuration from `public/config.yaml` through the backend API
- Renders service categories and service cards in a responsive React UI
- Lets you add categories and services from the UI
- Saves changes back to `public/config.yaml` via `POST /api/config`
- Supports optional Uptime Kuma monitoring and service ping checks
- Uses Docker Compose for development and local runtime

## What it uses

- `React 19` + `TypeScript`
- `Vite` for development server, proxying, and build
- `Tailwind CSS` via `@tailwindcss/vite`
- `Express` backend for config persistence
- `js-yaml` / `yaml` to parse and serialize YAML config
- `lucide-react` for icons
- `Docker Compose` to run the frontend, backend, Uptime Kuma, and sync service together

## Project structure

- `src/` - React app sources
- `src/App.tsx` - Dashboard UI and config handling
- `src/components/` - shared UI components like `DynamicIcon` and `UptimeBadge`
- `src/types/config.ts` - TypeScript config definitions
- `public/config.yaml` - dashboard configuration file read by the backend
- `scripts/server.js` - Express backend API that reads/writes `config.yaml`
- `scripts/sync-kuma.js` - optional script to synchronize Uptime Kuma data
- `docker-compose.yml` - local environment for the frontend, API, Uptime Kuma, and sync container
- `Dockerfile.dev` - frontend development container definition
- `Dockerfile.api` - backend API container definition
- `Dockerfile.sync` - sync container definition for Uptime Kuma

## Running locally with Docker

### Start the full stack

```bash
cd HomeLab
docker compose up -d --build
```

### Open the app

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- Uptime Kuma: `http://localhost:3001`

### Stop the stack

```bash
docker compose down
```

## Development without Docker

### Install dependencies

```bash
cd HomeLab
npm install
```

### Start the Vite app

```bash
npm run dev
```

The frontend will run on `http://localhost:5173` and proxy API requests to the backend through Vite.

### Start the backend API

```bash
node scripts/server.js
```

The backend listens on port `3000` by default and exposes:

- `GET /api/config` - returns the current YAML config
- `POST /api/config` - saves dashboard updates to `public/config.yaml`

## Build for production

```bash
npm run build
```

The output is generated into `dist/`.

## How the dashboard works

1. The frontend fetches `GET /api/config` from the backend.
2. The YAML config is parsed into React state.
3. Sections and service cards are rendered from that config.
4. When the user adds or updates a service, the app sends the updated config to `POST /api/config`.
5. The backend writes the updated YAML back to `public/config.yaml`.

## Mobile / app creation

This project is a web application.

### Android / iOS

To turn this into a mobile app, use a wrapper such as:

- [Capacitor](https://capacitorjs.com/)
- [Cordova](https://cordova.apache.org/)
- [Tauri](https://tauri.app/)

A common workflow is:

1. Build the web app with `npm run build`
2. Serve the built `dist/` files from a local or remote server
3. Wrap the web app using Capacitor or Cordova
4. Run native build commands for Android/iOS

### Progressive Web App (PWA)

This app does not currently include PWA configuration. To make it installable in a mobile browser, add:

- a web manifest
- service worker support
- HTTPS hosting for production

## How to use it

1. Open the dashboard in the browser.
2. Add a new category with `Kategorie`.
3. Add services inside a category using `Dienst hinzufügen`.
4. Provide a name, URL, icon name, optional description, and service type.
5. Enable Uptime Kuma monitoring if you want status tracking.
6. Save changes and refresh if needed.

## Notes

- The frontend is served by Vite in development.
- The backend stores the dashboard config in `public/config.yaml`.
- In Docker, the frontend uses `VITE_BACKEND_URL=http://dashboard-api:3000` and `VITE_KUMA_URL=http://uptime-kuma:3001`.
- `uptime-kuma` is only available inside Docker on the service network; use `http://localhost:3001` from the host browser.

## License

This project is licensed under the HomeLab Private Use License. It may be used for personal, non-commercial purposes only.

Commercial use, resale, or any money-making use of this project or derived products is not permitted without explicit written permission from the copyright holder.

See `LICENSE` for full terms.
