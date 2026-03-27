# IFZ14
# IFZ14 TRACKER — PROJECT ANALYSIS

## 1. Executive Summary
The **IFZ14 Tracker** is a sophisticated personal performance ecosystem designed as a "Personal Operating System." It goes beyond simple task tracking, employing a multi-layered engine architecture to calculate performance, detect behavioral patterns, and provide autonomous life-optimization suggestions. The system is built with a high-end, monochrome aesthetic inspired by TRON and Apple design philosophies.

---

## 2. Project Identity & Vision
The core philosophy of IFZ14 Tracker is **"System Awareness through Data Intelligence."**
- **Not a Tracker**: It is an observer and calculator of human performance.
- **Engine-Driven**: Performance is not just displayed; it is interpreted via weighted algorithms ("Truth Engine").
- **Autonomous Evolution**: The system adapts its structure based on historical performance and current capacity.

---

![img.png](img.png)
## 3. Technical Architecture
The application is built on a modern React/TypeScript stack designed for high-performance and fluid motion.

### Core Stack
- **Frontend**: React (Vite-powered)
- **State Management**: Zustand (Multi-store architecture: `daily`, `task`, `goal`, `analytics`, `auth`)
- **Animation**: Framer Motion (System-wide fluid transitions)
- **Data Visualization**: Recharts (Signal-style graphs)
- **Styling**: Tailwind CSS + Deeply customized Design System (`index.css`)

### Layered Architecture
1. **Interface Layer**: (`src/pages`, `src/components`) High-performance React components with heavy parallax and focus-driven UX.
2. **Engine Layer**: (`src/engines`) The "Brain" of the system. Modular logic for scoring, risk, patterns, and analytics.
3. **State Layer**: (`src/stores`) Reactive state that synchronizes the engine outputs with the UI.
4. **System Layer**: (`src/system`) Low-level visual behaviors like cursor light physics, parallax, and system intensity filters.

---

## 4. Core Engines (The Brain)
The most critical part of the repo is the `src/engines` directory:

| Engine | Responsibility | Key Logic |
| :--- | :--- | :--- |
| **ScoreEngine** | The "Truth Engine" | Calculates `SystemScore = Execution(50%) + Condition(20%) + Integrity(30%)`. |
| **AnalyticsEngine** | Causal Intelligence | Uses Pearson correlation and lag analysis to find links (e.g., Sleep → Score). |
| **AutoDayEngine** | Autonomous Planning | Predicts today's capacity and pre-fills the daily schedule. |
| **RiskEngine** | Burnout Detection | Identifies sequences of declining scores or high-stress signals. |
| **GoalEngine** | Objective Tracking | Computes progress, "pressure," and required pace for goals. |
| **PatternEngine** | Trend Detection | Identifies `RISING`, `DECLINING`, or `VOLATILE` performance patterns. |

---

## 5. Design System & UX
The design is defined by its **Visual DNA**:
- **Monochrome Dominance**: Pure black (#000), white, and curated grays. No bright colors unless critical.
- **Motion = Meaning**: Every load, input focus, and completion is animated to feel like a "machine booting."
- **Premium Realism**: Includes cursor-following light gradients, scanlines, and parallax depth layers.
- **Typography-Driven**: Uses `Clash Display` for headlines and `Inter`/`Satoshi` for functional data.

---

## 6. Data Model
Defined in `src/types/index.ts`, the model is built for evolution:
- **`DailyEntry`**: Central document for a day's data. Supports dynamic structures (templates) and structured "Truth Engine" inputs.
- **`Task`**: Features energy-type classification (`deep`, `light`, `quick`) and delay detection.
- **`Goal`**: Not just a deadline, but a live target that recalculates "contribution pressure" daily.
- **`CausalInsight`**: Output of the Analytics engine documenting verified performance drivers.

---

## 7. Current Capabilities
- **Daily Flow**: Formless, logic-controlled daily execution input.
- **Real-time Diagnostics**: Dashboard HUD showing system status, trend, and risk level.
- **Predictive Intelligence**: Morning predictions of expected daily score based on sleep and planned load.
- **Autonomous Adaptation**: System logs that document when the engine changes its own logic or structure to help the user.

---

## 8. Configuration
The system uses environment variables for branding and identity. 

### Setup
1. Copy the example environment file:
   ```powershell
   copy .env.example .env
   ```
2. Adjust the values in `.env` as needed:
   - `VITE_APP_NAME`: Display name of the system (default: IFZ14).
   - `VITE_APP_LEGAL`: Full legal/brand name (default: InterFrost).
   - `VITE_APP_DESCRIPTION`: System description shown on landing.

---

## 9. Storage Architecture
The IFZ14 Tracker is a **local-first application**. To ensure zero latency and offline availability, all data is persisted directly in the browser's `localStorage` via a multi-store [Zustand](https://github.com/pmndrs/zustand) configuration.

### Core Persistence
- **State Engine**: Managed in `src/stores`.
- **Auth**: User identities and hashed passwords are encrypted and stored locally.
- **Data Isolation**: Keys are scoped by user ID (e.g., `user1-daily-entries`) to support local multi-tenancy.

---

## 10. Conclusion
IFZ14 Tracker is a high-integration performance tool that treats human behavior as a system to be optimized. The codebase is highly modular, with a clean separation between raw data (`stores`), processing logic (`engines`), and premium visual presentation (`system/visual`).

Final Analysis generated on 2026-03-25. (Updated with Storage and Environment Configuration)

## 11. MariaDB Backend Slice
The repo now includes a minimal Node API for MariaDB under `server/`.

### Run the API
1. Copy `.env.example` to `.env`
2. Update these values:
   - `VITE_API_BASE_URL=http://localhost:4000`
   - `API_PORT=4000`
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - optional hardening: set both `API_ACCESS_KEY` and `VITE_API_ACCESS_KEY` to the same secret
3. Create the database objects from `server/schema.sql`
4. Start the API:
   ```powershell
   npm run api
   ```
5. Start the frontend in a second terminal:
   ```powershell
   npm run dev
   ```
6. Sign in, then open `Settings` or the `Control Panel` to verify:
   - API mode is enabled
   - API key is set if you configured one
   - API health is online
   - Daily / Task / Goal sync can retry cleanly

### Endpoints
- `GET /api/health`
- `GET /api/daily-entries?userId=<id>`
- `PUT /api/daily-entries/:date`
- `GET /api/tasks?userId=<id>`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id?userId=<id>`
- `GET /api/goals?userId=<id>`
- `PUT /api/goals/:id`
- `DELETE /api/goals/:id?userId=<id>`

### Example save payload
```json
{
  "userId": "demo-user",
  "payload": {
    "date": "2026-03-27",
    "completed": false
  }
}
```

### Sync Model
- If `VITE_API_BASE_URL` is missing, the app stays local-first.
- If it is present, `daily`, `tasks`, and `goals` hydrate from MariaDB at boot.
- Newer local data wins during retry/bootstrap reconciliation and is pushed back to MariaDB.
- If `API_ACCESS_KEY` is set on the server, every frontend API call must send the matching `VITE_API_ACCESS_KEY`.

### Auth Foundation
The backend now also has a first auth-backed API slice:
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `GET /api/auth/me`
- `GET /api/auth/config`

If `API_SESSION_SECRET` is set, signup/signin return a signed bearer token. This establishes the server-side identity layer needed before moving from client-supplied `userId` to backend-derived account identity.

### Identity Enforcement
- If `API_SESSION_SECRET` is not set, data routes still use the local/dev fallback and accept `userId`.
- If `API_SESSION_SECRET` is set, data routes derive `userId` from the bearer token and stop trusting client-supplied account identity.
- That applies to:
  - daily entries
  - tasks
  - goals
  - analytics history
