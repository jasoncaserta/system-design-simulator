import type { Node, Edge } from 'reactflow';

export type NodeType = 'client' | 'lb' | 'app' | 'cache' | 'db' | 'queue' | 'worker' | 'cdn' | 'blob-storage';
export type NodeStatus = 'healthy' | 'stressed' | 'overloaded' | 'idle';

export interface NodeData {
  type: NodeType;
  label: string;
  instances: number;
  maxCapacityPerInstance: number; // requests/sec per instance
  currentLoad: number;            // total requests/sec hitting this node
  status: NodeStatus;
}

export interface EdgeData {
  qps: number;
}

export interface SimulationParams {
  users: number;
  rpsPerUser: number;
  readWriteRatio: number; // 0-1, e.g. 0.8 is 80% read
  cacheHitRate: number;   // 0-1
  cdnHitRate: number;     // 0-1
  backgroundJobLoad: number;
  enableApiPriorityGate: boolean;
}

export interface SimulationStore extends SimulationParams {
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  nodeCounts: Record<string, number>;
  nodeCapacities: Record<string, number>;
  currentSystem: 'starter' | 'pickgpu' | 'custom';
  
  // Actions
  updateSimParams: (params: Partial<SimulationParams>) => void;
  updateNodeInstances: (nodeId: string, instances: number) => void;
  updateNodeCapacity: (nodeId: string, capacity: number) => void;
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
  runSimulation: () => void;
  loadStarterSystem: () => void;
  loadPickGPUSystem: () => void;
}
