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
import type { SimulationStore, SimulationParams, NodeData, NodeType, NodeStatus } from './types';

const INITIAL_PARAMS: SimulationParams = {
  users: 100,
  rpsPerUser: 0.1,
  readWriteRatio: 1.0,
  cacheHitRate: 0.8,
};

const getStarterNodes = (): Node<NodeData>[] => [
  {
    id: 'client',
    type: 'custom',
    position: { x: 0, y: 150 },
    data: { type: 'client', label: 'Clients', instances: 1, maxCapacityPerInstance: 1000000, currentLoad: 0, status: 'healthy' },
  },
  {
    id: 'lb',
    type: 'custom',
    position: { x: 250, y: 150 },
    data: { type: 'lb', label: 'Load Balancer', instances: 1, maxCapacityPerInstance: 250, currentLoad: 0, status: 'healthy' },
  },
  {
    id: 'app',
    type: 'custom',
    position: { x: 500, y: 150 },
    data: { type: 'app', label: 'App Servers', instances: 1, maxCapacityPerInstance: 50, currentLoad: 0, status: 'healthy' },
  },
  {
    id: 'cache',
    type: 'custom',
    position: { x: 750, y: 50 },
    data: { type: 'cache', label: 'Redis Cache', instances: 1, maxCapacityPerInstance: 500, currentLoad: 0, status: 'healthy' },
  },
  {
    id: 'db',
    type: 'custom',
    position: { x: 750, y: 250 },
    data: { type: 'db', label: 'Postgres DB', instances: 1, maxCapacityPerInstance: 25, currentLoad: 0, status: 'healthy' },
  },
];

const starterEdges: Edge[] = [
  { id: 'e-client-lb', source: 'client', target: 'lb' },
  { id: 'e-lb-app', source: 'lb', target: 'app' },
  { id: 'e-app-cache', source: 'app', target: 'cache' },
  { id: 'e-app-db', source: 'app', target: 'db' },
];

export const useSimulatorStore = create<SimulationStore>((set, get) => ({
  ...INITIAL_PARAMS,
  nodes: getStarterNodes(),
  edges: starterEdges,

  updateSimParams: (params) => {
    set(params);
    get().runSimulation();
  },

  updateNodeInstances: (nodeId, instances) => {
    set((state) => ({
      nodes: state.nodes.map((node) => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, instances: Math.max(1, instances) } }
          : node
      ),
    }));
    get().runSimulation();
  },

  updateNodeCapacity: (nodeId, capacity) => {
    set((state) => ({
      nodes: state.nodes.map((node) => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, maxCapacityPerInstance: Math.max(1, capacity) } }
          : node
      ),
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
      nodes: getStarterNodes(),
      edges: starterEdges,
      ...INITIAL_PARAMS,
    });
    get().runSimulation();
  },

  runSimulation: () => {
    const { nodes, edges, users, rpsPerUser, readWriteRatio, cacheHitRate } = get();
    
    // 1. Calculate base load
    const totalQps = users * rpsPerUser;

    // 2. Map nodes for easy lookup and reset load
    const nodeMap = new Map(nodes.map(n => [n.id, { ...n.data, currentLoad: 0 }]));
    
    // 3. Simple Flow Propagation (assuming Starter System structure for MVP logic)
    // In a full implementation, we'd use BFS/DFS on the graph.
    
    // Client -> LB
    const clientNode = nodeMap.get('client');
    if (clientNode) clientNode.currentLoad = totalQps;

    const lbNode = nodeMap.get('lb');
    if (lbNode) lbNode.currentLoad = totalQps;

    const appNode = nodeMap.get('app');
    if (appNode) appNode.currentLoad = totalQps;

    const cacheNode = nodeMap.get('cache');
    if (cacheNode) {
      // Cache only sees read traffic
      cacheNode.currentLoad = totalQps * readWriteRatio;
    }

    const dbNode = nodeMap.get('db');
    if (dbNode) {
      const readTraffic = totalQps * readWriteRatio;
      const writeTraffic = totalQps * (1 - readWriteRatio);
      const cacheMisses = readTraffic * (1 - cacheHitRate);
      dbNode.currentLoad = writeTraffic + cacheMisses;
    }

    // 4. Update Node Statuses
    const updatedNodes = nodes.map(node => {
      const data = nodeMap.get(node.id);
      if (!data) return node;

      const totalCapacity = data.instances * data.maxCapacityPerInstance;
      const loadRatio = data.currentLoad / totalCapacity;

      let status: NodeStatus = 'healthy';
      if (loadRatio > 1.0) status = 'overloaded';
      else if (loadRatio > 0.8) status = 'stressed';
      else if (data.currentLoad === 0) status = 'idle';

      return {
        ...node,
        data: { ...data, status }
      };
    });

    set({ nodes: updatedNodes });
  },
}));
