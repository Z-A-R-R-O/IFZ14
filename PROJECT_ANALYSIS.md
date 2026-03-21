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

## 8. Conclusion
IFZ14 Tracker is a high-integration performance tool that treats human behavior as a system to be optimized. The codebase is highly modular, with a clean separation between raw data (`stores`), processing logic (`engines`), and premium visual presentation (`system/visual`).

Final Analysis generated on 2026-03-20.
