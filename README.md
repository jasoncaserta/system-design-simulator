# System Design Simulator

An interactive, frontend-first backend architecture simulator built with **React**, **TypeScript**, and **React Flow**. Visualize how your system behaves under load, identify bottlenecks, and experiment with horizontal and vertical scaling strategies in real-time.

![System Design Simulator Screenshot](https://github.com/jasoncaserta/system-design-simulator/blob/main/src/assets/hero.png?raw=true)

## 🚀 Features

- **Interactive Architecture Canvas**: Drag, drop, and connect system components visually using React Flow.
- **Steady-State Simulation Engine**: Real-time load propagation from Clients through LBs, App Servers, Caches, and Databases.
- **Horizontal Scaling**: Add or remove instances of any component to distribute traffic.
- **Vertical Scaling**: Choose from predefined instance sizes (Small, Medium, Large, X-Large) to increase per-node capacity.
- **Bottleneck Diagnosis**: Intelligent overlay panel that flags overloaded components and provides tailored remediation advice.
- **Starter Template**: Instantly load a classic "Client → LB → App → Cache → DB" architecture to begin simulating.
- **Live Visual Metrics**: Components change color (Green → Yellow → Red) and show animated load bars based on current QPS vs. total capacity.

## 🛠️ Tech Stack

- **Framework**: React 19 (TypeScript)
- **State Management**: Zustand (Simulation logic & Graph state)
- **Diagramming**: React Flow v11
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Build Tool**: Vite 8

## 📊 Production Scale Benchmarks

The simulator uses realistic, production-grade performance benchmarks for its default infrastructure capacities:

| Component       | Base Capacity (Medium) | Real-World Equivalent           |
|-----------------|------------------------|---------------------------------|
| **Load Balancer** | 10,000 RPS           | Nginx / AWS ALB                 |
| **App Server**   | 500 RPS                | Node.js / Go / FastAPI CRUD     |
| **Redis Cache**  | 50,000 RPS             | Single-node Redis (In-Memory)   |
| **Postgres DB**  | 1,000 RPS              | Indexed SQL CRUD Operations     |

### Scaling Tiers
- **Small**: 0.5x Base Capacity
- **Medium**: 1.0x Base Capacity (Default)
- **Large**: 2.0x Base Capacity
- **X-Large**: 4.0x Base Capacity

## 🧠 Simulation Logic

The simulator uses a **Steady-State Mathematical Model** to calculate instantaneous load across the system graph:

1.  **Traffic Generation**: `Total QPS = Concurrent Users * Requests Per User`.
2.  **Starter System**: Launches with **1,000 users** at **0.1 RPS** (100 total QPS) across **1 App Server**.
3.  **Data Flow**:
    - **Read Traffic**: `Total QPS * Read Ratio`. Distributed to Cache.
    - **Cache Misses**: `Read Traffic * (1 - Cache Hit Rate)`. Fall through to Database.
    - **Write Traffic**: `Total QPS * (1 - Read Ratio)`. Routed directly to Database.
4.  **Capacity**: `Node Total Capacity = Instance Count * Capacity Per Instance Size`.
5.  **Health States**:
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
2. **Modify Behavior**: Tweak **Read vs. Write Ratio** or **Cache Hit Rate** to see how they impact database and cache load.
3. **Scale Your System**: 
   - Click **+** or **-** on infrastructure nodes for **Horizontal Scaling**.
   - Change the **Instance Size** dropdown for **Vertical Scaling**.
4. **Fix Bottlenecks**: Watch the **Bottleneck Panel** for alerts when nodes turn red and follow the "Fix" recommendations.

---

Built with ❤️ for system design enthusiasts.
