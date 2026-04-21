# System Design Simulator

An interactive, frontend-first backend architecture simulator built with **React**, **TypeScript**, and **React Flow**. Visualize how your system behaves under load, identify bottlenecks, and experiment with horizontal and vertical scaling strategies in real-time.

![System Design Simulator Screenshot](https://github.com/jasoncaserta/system-design-simulator/blob/main/src/assets/hero.png?raw=true)

## 🚀 Features

- **Interactive Architecture Canvas**: Drag, drop, and connect system components visually using React Flow.
- **Steady-State Simulation Engine**: Real-time load propagation through DDIA-style layers such as request routing, stateless services, serving caches, durable stores, derived-state pipelines, and serving databases.
- **Horizontal Scaling**: Add or remove instances of any component to distribute traffic.
- **Vertical Scaling**: Choose from predefined instance sizes (Small, Medium, Large, X-Large) to increase per-node capacity.
- **Bottleneck Diagnosis**: Intelligent overlay panel that flags overloaded components and provides tailored remediation advice.
- **Preset Contrast**: Switch between a simple starter system and a lifecycle-heavy `pickGPU` system that models durable inputs, derived-state refresh, recovery, and backfill flows.
- **Live Visual Metrics**: Components change color (Green → Yellow → Red) and show animated load bars based on current work rate vs. total capacity.

## 🛠️ Tech Stack

- **Framework**: React 19 (TypeScript)
- **State Management**: Zustand (Simulation logic & Graph state)
- **Diagramming**: React Flow v11
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Build Tool**: Vite 8

## 📊 Production Scale Benchmarks

The simulator uses realistic, production-grade performance benchmarks for its default infrastructure capacities:

| Component | Base Capacity (Medium) | Modeled Role |
|-----------|-------------------------|--------------|
| **Request Router** | 10,000 ops/s | Origin traffic distribution |
| **Stateless Service** | 500 ops/s | Request-handling compute tier |
| **Serving Cache** | 50,000 ops/s | Derived hot-path cache |
| **Serving Database** | 1,000 ops/s | Serving-state read/write store |
| **Derived State Pipeline** | 120 ops/s | Derived-data refresh stage |
| **Recovery Pipeline** | 180 ops/s | Durable-input replay / recovery stage |

### Scaling Tiers
- **Small**: 0.5x Base Capacity
- **Medium**: 1.0x Base Capacity (Default)
- **Large**: 2.0x Base Capacity
- **X-Large**: 4.0x Base Capacity

## 🧠 Simulation Logic

The simulator uses a **Steady-State Mathematical Model** to calculate instantaneous load across the system graph:

1.  **Traffic Generation**: `Total QPS = Concurrent Users * Requests Per User (RPS)`.
2.  **Starter System**: Launches with **1,000 users** at **0.1 RPS** (100 total QPS) across **1 Stateless Service**.
3.  **Serving Flow**:
    - **Edge Misses**: `Total QPS * (1 - Edge Cache Hit Rate)`.
    - **Serving Reads**: `Edge Misses * Read/Write Ratio`.
    - **Serving Cache Misses**: `Serving Reads * (1 - Serving Cache Hit Rate)`. Fall through to the serving database.
4.  **Background Flow**:
    - **Ingestion Pressure** drives upstream fetch, normalization, and durable writes.
    - **Derived State Pressure** drives derived-state refresh from durable inputs into serving state.
    - **Backfill Pressure** drives deferred recomputation over older data.
    - **Recovery / Replay Load** models rebuilding serving state from durable inputs.
5.  **Coordination**: The read-priority gate delays background writers when serving reads are high, creating backlog in lifecycle stages before pressure reaches the serving database.
6.  **Capacity**: `Node Total Capacity = Instance Count * Capacity Per Instance Size`.
7.  **Health States**:
    - **Healthy**: Load < 80%
    - **Stressed**: Load 80% - 100% (Yellow)
    - **Overloaded**: Load > 100% (Red)

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/jasoncaserta/system-design-simulator.git
   cd system-design-simulator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📖 Usage

1. **Adjust Traffic**: Use the sliders in the **Global Traffic** section to increase users or RPS.
2. **Modify Behavior**: Tweak serving-path controls such as **Read/Write Ratio**, **Serving Cache Hit Rate**, and **Edge Cache Hit Rate**.
3. **Model Background Work**: Adjust **Ingestion Pressure**, **Derived State Pressure**, **Backfill Pressure**, and **Recovery / Replay Load** to simulate how durable inputs turn into serving state.
4. **Scale Your System**: 
   - Click **+** or **-** on infrastructure nodes for **Horizontal Scaling**.
   - Change the **Instance Size** dropdown for **Vertical Scaling**.
5. **Fix Bottlenecks**: Watch the **Bottleneck Panel** for alerts when nodes turn red and follow the "Fix" recommendations.

---

Built with ❤️ for system design enthusiasts.
