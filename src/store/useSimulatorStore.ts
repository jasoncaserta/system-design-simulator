import { create } from 'zustand';
import { 
  addEdge, 
  applyNodeChanges, 
  applyEdgeChanges,
} from 'reactflow';
import type { 
  Connection, 
  Edge, 
  Node, 
  NodeChange, 
  EdgeChange 
} from 'reactflow';
import type { SimulationStore, SimulationParams, NodeData, EdgeData, NodeType } from './types';

const INITIAL_PARAMS: SimulationParams = {
  users: 1000,
  rpsPerUser: 0.1,
  readWriteRatio: 0.8,
  cacheHitRate: 0.8,
  cdnHitRate: 0,
  backgroundJobLoad: 0,
  enableApiPriorityGate: true,
};

const INITIAL_COUNTS = {
  client: 1,
  lb: 1,
  app: 1,
  cache: 1,
  db: 1,
  cdn: 0,
  queue: 0,
  worker: 0,
  'blob-storage': 0,
};

const INITIAL_CAPACITIES = {
  client: 1000000,
  lb: 5000,
  app: 250,
  cache: 25000,
  db: 500,
  cdn: 100000,
  queue: 10000,
  worker: 1000,
  'blob-storage': 5000,
};

const LAYERS = [
  { id: 'client', type: 'client', label: 'CLIENTS', x: 0, y: 200 },
  { id: 'cdn', type: 'cdn', label: 'CDN (EDGE)', x: 380, y: 200 },
  { id: 'lb', type: 'lb', label: 'LOAD BALANCER', x: 760, y: 200 },
  { id: 'app', type: 'app', label: 'APP SERVER', x: 1140, y: 200 },
  { id: 'cache', type: 'cache', label: 'IN-PROCESS CACHE', x: 1520, y: 50 },
  { id: 'db', type: 'db', label: 'SQLITE DB', x: 1520, y: 350 },
  { id: 'queue', type: 'queue', label: 'SCHEDULER', x: 760, y: 500 },
  { id: 'worker', type: 'worker', label: 'SCRAPERS', x: 1140, y: 500 },
  { id: 'blob-storage', type: 'blob-storage', label: 'CSV STORE', x: 1520, y: 500 },
];

export const useSimulatorStore = create<SimulationStore>((set, get) => ({
  ...INITIAL_PARAMS,
  nodeCounts: { ...INITIAL_COUNTS },
  nodeCapacities: { ...INITIAL_CAPACITIES },
  nodes: [],
  edges: [],
  currentSystem: 'starter',

  updateSimParams: (params) => {
    set({ ...params, currentSystem: 'custom' });
    get().runSimulation();
  },

  updateNodeInstances: (tierId, instances) => {
    // Only remove trailing numeric IDs (e.g., app-0 -> app, but leave blob-storage alone)
    const cleanTierId = tierId.replace(/-[0-9]+$/, '');
    set((state) => ({
      nodeCounts: {
        ...state.nodeCounts,
        [cleanTierId]: Math.max(1, instances)
      },
      currentSystem: 'custom'
    }));
    get().runSimulation();
  },

  updateNodeCapacity: (tierId, capacity) => {
    const cleanTierId = tierId.replace(/-[0-9]+$/, '');
    set((state) => ({
      nodeCapacities: {
        ...state.nodeCapacities,
        [cleanTierId]: Math.max(1, capacity)
      },
      currentSystem: 'custom'
    }));
    get().runSimulation();
  },

  onNodesChange: (changes: NodeChange[]) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  onConnect: (connection: Connection) => {
    set((state) => ({
      edges: addEdge(connection, state.edges),
      currentSystem: 'custom'
    }));
    get().runSimulation();
  },

  loadStarterSystem: () => {
    set({
      nodeCounts: {
        client: 1,
        lb: 1,
        app: 1,
        cache: 1,
        db: 1,
        cdn: 0,
        queue: 0,
        worker: 0,
        'blob-storage': 0,
      },
      nodeCapacities: { ...INITIAL_CAPACITIES },
      ...INITIAL_PARAMS,
      cdnHitRate: 0,
      backgroundJobLoad: 0,
      currentSystem: 'starter'
    });
    get().runSimulation();
  },

  loadPickGPUSystem: () => {
    set({
      nodeCounts: {
        client: 1,
        cdn: 1,
        lb: 1,
        app: 1,
        cache: 1,
        db: 1,
        queue: 1,
        worker: 1,
        'blob-storage': 1,
      },
      nodeCapacities: {
        client: 1000000,
        cdn: 100000,
        lb: 5000,
        app: 200, // pickGPU uses single-process Uvicorn, low capacity
        cache: 5000,
        db: 100, // SQLite single-writer is a bottleneck
        queue: 1,
        worker: 20, // Scrapers are slow
        'blob-storage': 1000,
      },
      users: 5000,
      rpsPerUser: 0.1,
      readWriteRatio: 0.95, // Highly read-heavy
      cacheHitRate: 0.7,
      cdnHitRate: 0.9,
      backgroundJobLoad: 50,
      enableApiPriorityGate: true,
      currentSystem: 'pickgpu'
    });
    get().runSimulation();
  },

  runSimulation: () => {
    const { 
      users, rpsPerUser, readWriteRatio, cacheHitRate, cdnHitRate, 
      backgroundJobLoad, enableApiPriorityGate, nodeCounts, nodeCapacities 
    } = get();
    
    const totalQps = users * rpsPerUser;
    const activeLayers = LAYERS.filter(l => (nodeCounts[l.id] || 0) > 0);
    
    // 1. Calculate dynamic X positions to eliminate gaps from inactive tiers
    const uniqueX = Array.from(new Set(activeLayers.map(l => l.x))).sort((a, b) => a - b);
    const xMap = new Map(uniqueX.map((x, i) => [x, i * 380]));

    const columns = new Map<number, typeof LAYERS>();
    activeLayers.forEach(layer => {
      const dynamicX = xMap.get(layer.x)!;
      const col = columns.get(dynamicX) || [];
      col.push(layer);
      columns.set(dynamicX, col);
    });

    const INSTANCE_SPACING = 160;
    const TIER_GAP = 100;
    const TARGET_CENTER_Y = 200;

    const newNodes: Node<NodeData>[] = [];
    const tierInstances: Record<string, string[]> = {};

    columns.forEach((layersInCol, dynamicX) => {
      let totalColHeight = 0;
      const layerHeights = layersInCol.map(layer => {
        const count = nodeCounts[layer.id] || 1;
        const h = count * INSTANCE_SPACING;
        totalColHeight += h;
        return h;
      });
      totalColHeight += (layersInCol.length - 1) * TIER_GAP;

      let currentY = TARGET_CENTER_Y - totalColHeight / 2;

      layersInCol.forEach((layer, idx) => {
        const count = nodeCounts[layer.id] || 1;
        const layerHeight = layerHeights[idx];
        const layerCenterY = currentY + layerHeight / 2;
        
        tierInstances[layer.id] = [];
        for (let i = 0; i < count; i++) {
          const id = count > 1 ? `${layer.id}-${i}` : layer.id;
          tierInstances[layer.id].push(id);
          
          const yOffset = (i - (count - 1) / 2) * INSTANCE_SPACING;
          
          newNodes.push({
            id,
            type: 'custom',
            position: { x: dynamicX, y: layerCenterY + yOffset },
            data: {
              type: layer.type as NodeType,
              label: count > 1 ? `${layer.label} ${i + 1}` : layer.label,
              instances: 1,
              maxCapacityPerInstance: nodeCapacities[layer.id],
              currentLoad: 0,
              status: 'healthy'
            }
          });
        }
        currentY += layerHeight + TIER_GAP;
      });
    });

    const nodeMap = new Map(newNodes.map(n => [n.id, n]));

    // --- Traffic Distribution ---
    
    // 1. Read Path (Synchronous)
    const cdnMisses = totalQps * (1 - cdnHitRate);
    const readTraffic = cdnMisses * readWriteRatio;
    const writeTraffic = cdnMisses * (1 - readWriteRatio);
    const cacheMisses = readTraffic * (1 - cacheHitRate);
    const apiDbTraffic = writeTraffic + cacheMisses;

    const distribute = (tierId: string, load: number) => {
      const ids = tierInstances[tierId] || [];
      ids.forEach(id => {
        const node = nodeMap.get(id);
        if (node) node.data.currentLoad += load / ids.length;
      });
    };

    distribute('client', totalQps);
    distribute('cdn', totalQps);
    distribute('lb', cdnMisses);
    distribute('app', cdnMisses);
    distribute('cache', readTraffic);
    distribute('db', apiDbTraffic);

    // 2. Write Path (Asynchronous / ETL)
    const appLoadRatio = (cdnMisses / (nodeCounts['app'] * nodeCapacities['app'])) || 0;
    let actualBackgroundDbTraffic = backgroundJobLoad;
    let workerStatus: NodeStatus = 'healthy';

    if (enableApiPriorityGate && appLoadRatio > 0.5) {
      // API Priority Gate kicks in: background writes are throttled to favor user traffic
      actualBackgroundDbTraffic = backgroundJobLoad * Math.max(0, 1 - (appLoadRatio - 0.5) * 2);
      workerStatus = 'stressed';
    }

    distribute('queue', backgroundJobLoad);
    distribute('worker', backgroundJobLoad);
    distribute('blob-storage', backgroundJobLoad);
    distribute('db', actualBackgroundDbTraffic);

    // 3. Update Statuses
    newNodes.forEach(node => {
      const loadRatio = node.data.currentLoad / node.data.maxCapacityPerInstance;
      
      // Override for worker if gated
      if (node.id.startsWith('worker') && workerStatus === 'stressed') {
        node.data.status = 'stressed';
      } else if (loadRatio > 1.0) {
        node.data.status = 'overloaded';
      } else if (loadRatio > 0.8) {
        node.data.status = 'stressed';
      } else if (node.data.currentLoad === 0) {
        node.data.status = 'idle';
      } else {
        node.data.status = 'healthy';
      }
    });

    // 4. Generate Edges
    const newEdges: Edge<EdgeData>[] = [];
    const connectTiers = (sourceTier: string, targetTier: string, traffic: number) => {
      const sources = tierInstances[sourceTier] || [];
      const targets = tierInstances[targetTier] || [];
      if (sources.length === 0 || targets.length === 0) return;
      const qpsPerEdge = traffic / (sources.length * targets.length);

      sources.forEach(s => {
        targets.forEach(t => {
          newEdges.push({
            id: `e-${s}-${t}`,
            source: s,
            target: t,
            type: 'custom',
            data: { qps: qpsPerEdge },
          });
        });
      });
    };

    // Read edges
    if ((nodeCounts['cdn'] || 0) > 0) {
      connectTiers('client', 'cdn', totalQps);
      connectTiers('cdn', 'lb', cdnMisses);
    } else {
      connectTiers('client', 'lb', totalQps);
    }
    connectTiers('lb', 'app', cdnMisses);
    connectTiers('app', 'cache', readTraffic);
    connectTiers('app', 'db', apiDbTraffic);

    // Write edges
    connectTiers('queue', 'worker', backgroundJobLoad);
    connectTiers('worker', 'blob-storage', backgroundJobLoad);
    connectTiers('blob-storage', 'db', actualBackgroundDbTraffic);

    set({ nodes: newNodes, edges: newEdges });
  },
}));
