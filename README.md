# IFZ14 — Personal Performance System

**An evolving personal system for daily execution, goals, and review.**

[Live site](https://ifz14.vercel.app)

IFZ14 explores how daily routines, tasks, goals, and personal signals can be gathered into a system that makes patterns easier to inspect. It combines a high-contrast interface with explicit scoring and analytics logic.

**Status:** evolving prototype. The repository includes a browser-first application and an optional Node/Express API with MariaDB support. A deployed interface does not prove that every API pathway is configured or production-ready.

## What is in the repository

- Daily entries and configurable routines.
- Task and goal tracking.
- Scoring logic for execution, body-habit signals, and other recorded inputs.
- Analytics, reports, pattern signals, suggestions, and risk-related heuristics.
- React and TypeScript UI with Vite, Zustand, Framer Motion, and Recharts.
- An Express API slice backed by MySQL/MariaDB, with optional API-key and session-token configuration.

The scoring engine is a product heuristic—not a clinical assessment, scientific diagnosis, or measure of human worth.

## Architecture at a glance

| Layer | Technologies / responsibilities |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| State | Zustand stores for daily entries, tasks, goals, analytics, preferences, and auth state |
| Visualisation | Recharts and related visual components |
| API | Node.js, Express, mysql2 |
| Data | Browser-local persistence by default; optional MariaDB-backed API |

## Run locally

Prerequisites: Node.js, npm, and—if using the API—a MariaDB instance.

1. Install dependencies with **npm install**.
2. Start the frontend with **npm run dev**.
3. For API-backed mode, configure the environment variables below, create the database, and apply **server/schema.sql**.
4. Start the API separately with **npm run api**.

The API listens on port 4000 by default and the Vite development server usually listens on port 5173.

## Environment configuration

Create a root **.env** file from the supplied **.env.example**. The example contains local-development placeholders only; replace database credentials and generated secrets for your own environment. Keep **.env** private and never commit real credentials.

Important settings include **DB_HOST**, **DB_PORT**, **DB_USER**, **DB_PASSWORD**, **DB_NAME**, **API_PORT**, **API_CORS_ORIGIN**, and optional **API_ACCESS_KEY**, **API_SESSION_SECRET**, **VITE_API_BASE_URL**, and **VITE_API_ACCESS_KEY**.

If the API session secret is not configured, the API uses a development-oriented identity fallback that accepts a user ID from the request. Do not expose that mode to untrusted users.

## Verification commands

- **npm test** — run the Vitest suite.
- **npm run build** — TypeScript project build and Vite production build.

These commands are provided by the repository; check their current results before relying on a release.

## Security and data boundaries

The current client-side authentication state is stored in browser storage. That is useful for a prototype, but it is not a substitute for a properly reviewed production identity system. The server API has separate configuration and trust boundaries, and should receive a dedicated security review before handling real accounts or sensitive information.

Use synthetic or non-sensitive data while evaluating the application. Do not treat heuristic scores as clinical or objective psychological measurements.

## Project structure

- **src/engines/** — scoring, goals, analytics, suggestions, patterns, and other engine modules.
- **src/stores/** — persisted application state.
- **src/pages/** and **src/components/** — UI surfaces and shared components.
- **src/features/** — feature-level modules for analytics, daily flow, and reports.
- **server/** — Express API, database access, auth helpers, and schema.

*Measure the system. Keep the human bigger than the score.*
