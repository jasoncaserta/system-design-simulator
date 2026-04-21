import type { Node, Edge } from 'reactflow';

export type NodeType =
  | 'client'
  | 'lb'
  | 'app'
  | 'cache'
  | 'db'
  | 'queue'
  | 'worker'
  | 'cdn'
  | 'blob-storage'
  | 'recompute'
  | 'bootstrap'
  | 'history';
export type NodeStatus = 'healthy' | 'stressed' | 'overloaded' | 'idle';
export type RefreshCadence = 'rare' | 'periodic' | 'frequent' | 'continuous';
export type JobCost = 'light' | 'medium' | 'heavy' | 'very_heavy';
export type BackfillMode = 'off' | 'catch_up' | 'steady' | 'aggressive';
export type RecoveryMode = 'off' | 'startup' | 'rebuild';

export interface NodeData {
  type: NodeType;
  label: string;
  implementationLabel?: string;
  instances: number;
  maxCapacityPerInstance: number; // work units/sec per instance
  currentLoad: number;            // total work units/sec hitting this node
  status: NodeStatus;
}

export interface EdgeData {
  throughput: number;
  kind: 'request' | 'data';
}

export interface SimulationParams {
  users: number;
  rpsPerUser: number;
  readWriteRatio: number; // 0-1 share of origin traffic that turns into cache/database-backed serving reads
  cacheHitRate: number;   // 0-1
  cdnHitRate: number;     // 0-1
  sourceJobTypes: number; // number of distinct scheduled source workflows
  refreshCadence: RefreshCadence; // how often freshness-sensitive source jobs run
  averageJobCost: JobCost; // average compute/IO work per job run
  derivedStateCadence: RefreshCadence; // how often serving state is refreshed from durable inputs
  backfillMode: BackfillMode; // deferred historical processing intensity
  recoveryMode: RecoveryMode; // recovery / replay intensity
  maxBackgroundConcurrency: number; // abstract parallelism budget for background work
  enableApiPriorityGate: boolean;
}

export interface SimulationStore extends SimulationParams {
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  nodeCounts: Record<string, number>;
  nodeCapacities: Record<string, number>;
  currentSystem: 'starter' | 'pickgpu' | 'custom';
  expandedNodeId: string | null;
  showNodeConfig: boolean;
  implementationLabels: Record<string, string>;

  // Actions
  updateSimParams: (params: Partial<SimulationParams>) => void;
  updateNodeInstances: (nodeId: string, instances: number) => void;
  updateNodeCapacity: (nodeId: string, capacity: number) => void;
  updateImplementationLabel: (nodeId: string, label: string) => void;
  setExpandedNodeId: (id: string | null) => void;
  toggleNodeConfig: () => void;
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
  runSimulation: () => void;
  loadStarterSystem: () => void;
  loadPickGPUSystem: () => void;
}
