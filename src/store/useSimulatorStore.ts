import { create } from 'zustand';
import { 
  addEdge, 
  applyNodeChanges, 
  applyEdgeChanges,
  MarkerType,
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
  users: 100,
  rpsPerUser: 0.1,
  readWriteRatio: 1.0,
  cacheHitRate: 0.8,
};

const INITIAL_COUNTS = {
  client: 1,
  lb: 1,
  app: 1,
  cache: 1,
  db: 1,
};

const INITIAL_CAPACITIES = {
  client: 1000000,
  lb: 125,
  app: 25,
  cache: 250,
  db: 12.5,
};

const LAYERS = [
  { id: 'client', type: 'client', label: 'Clients', x: 0, y: 200 },
  { id: 'lb', type: 'lb', label: 'Load Balancer', x: 380, y: 200 },
  { id: 'app', type: 'app', label: 'App Server', x: 760, y: 200 },
  { id: 'cache', type: 'cache', label: 'Redis Cache', x: 1140, y: 50 },
  { id: 'db', type: 'db', label: 'Postgres DB', x: 1140, y: 350 },
];

export const useSimulatorStore = create<SimulationStore>((set, get) => ({
  ...INITIAL_PARAMS,
  nodeCounts: { ...INITIAL_COUNTS },
  nodeCapacities: { ...INITIAL_CAPACITIES },
  nodes: [],
  edges: [],

  updateSimParams: (params) => {
    set(params);
    get().runSimulation();
  },

  updateNodeInstances: (tierId, instances) => {
    // Check if the tier exists in our counts
    const cleanTierId = tierId.split('-')[0]; // Handle exploded IDs
    set((state) => ({
      nodeCounts: {
        ...state.nodeCounts,
        [cleanTierId]: Math.max(1, instances)
      }
    }));
    get().runSimulation();
  },

  updateNodeCapacity: (tierId, capacity) => {
    const cleanTierId = tierId.split('-')[0];
    set((state) => ({
      nodeCapacities: {
        ...state.nodeCapacities,
        [cleanTierId]: Math.max(1, capacity)
      }
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
    }));
    get().runSimulation();
  },

  loadStarterSystem: () => {
    set({
      nodeCounts: { ...INITIAL_COUNTS },
      nodeCapacities: { ...INITIAL_CAPACITIES },
      ...INITIAL_PARAMS,
    });
    get().runSimulation();
  },

  runSimulation: () => {
    const { users, rpsPerUser, readWriteRatio, cacheHitRate, nodeCounts, nodeCapacities } = get();
    const totalQps = users * rpsPerUser;
    
    // 1. Group layers by X-column to calculate dynamic Y positions
    const columns = new Map<number, typeof LAYERS>();
    LAYERS.forEach(layer => {
      const col = columns.get(layer.x) || [];
      col.push(layer);
      columns.set(layer.x, col);
    });

    const INSTANCE_SPACING = 160;
    const TIER_GAP = 100;
    const TARGET_CENTER_Y = 200;

    const newNodes: Node<NodeData>[] = [];
    const tierInstances: Record<string, string[]> = {};

    columns.forEach((layersInCol, x) => {
      // Calculate total height of this column
      let totalColHeight = 0;
      const layerHeights = layersInCol.map(layer => {
        const count = nodeCounts[layer.id] || 1;
        const h = count * INSTANCE_SPACING;
        totalColHeight += h;
        return h;
      });
      totalColHeight += (layersInCol.length - 1) * TIER_GAP;

      // Start placing from top
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
            position: { x: layer.x, y: layerCenterY + yOffset },
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

    // 2. Distribute Load
    const nodeMap = new Map(newNodes.map(n => [n.id, n]));

    // Client -> LB
    const clientIds = tierInstances['client'];
    const lbIds = tierInstances['lb'];
    clientIds.forEach(id => {
      const node = nodeMap.get(id);
      if (node) node.data.currentLoad = totalQps / clientIds.length;
    });

    lbIds.forEach(id => {
      const node = nodeMap.get(id);
      if (node) node.data.currentLoad = totalQps / lbIds.length;
    });

    // LB -> App
    const appIds = tierInstances['app'];
    appIds.forEach(id => {
      const node = nodeMap.get(id);
      if (node) node.data.currentLoad = totalQps / appIds.length;
    });

    // App -> Cache/DB
    const cacheIds = tierInstances['cache'];
    const dbIds = tierInstances['db'];
    
    const readTraffic = totalQps * readWriteRatio;
    const writeTraffic = totalQps * (1 - readWriteRatio);
    const cacheMisses = readTraffic * (1 - cacheHitRate);
    const dbTotalTraffic = writeTraffic + cacheMisses;

    cacheIds.forEach(id => {
      const node = nodeMap.get(id);
      if (node) node.data.currentLoad = (readTraffic) / cacheIds.length;
    });

    dbIds.forEach(id => {
      const node = nodeMap.get(id);
      if (node) node.data.currentLoad = dbTotalTraffic / dbIds.length;
    });

    // 3. Update Statuses
    newNodes.forEach(node => {
      const loadRatio = node.data.currentLoad / node.data.maxCapacityPerInstance;
      if (loadRatio > 1.0) node.data.status = 'overloaded';
      else if (loadRatio > 0.8) node.data.status = 'stressed';
      else if (node.data.currentLoad === 0) node.data.status = 'idle';
      else node.data.status = 'healthy';
    });

    // 4. Generate Edges
    const newEdges: Edge<EdgeData>[] = [];
    
    // Helper to connect tiers
    const connectTiers = (sourceTier: string, targetTier: string, traffic: number) => {
      const sources = tierInstances[sourceTier];
      const targets = tierInstances[targetTier];
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

    connectTiers('client', 'lb', totalQps);
    connectTiers('lb', 'app', totalQps);
    connectTiers('app', 'cache', readTraffic);
    connectTiers('app', 'db', dbTotalTraffic);

    set({ nodes: newNodes, edges: newEdges });
  },
}));
