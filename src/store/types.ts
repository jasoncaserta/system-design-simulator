import type { Connection, Edge, EdgeChange, Node, NodeChange } from 'reactflow';

export type NodeType =
  | 'client'
  | 'load-balancer'
  | 'service'
  | 'cache'
  | 'relational-db'
  | 'nosql-db'
  | 'message-queue'
  | 'worker'
  | 'cdn'
  | 'object-store'
  | 'batch-processor';
export type NodeStatus = 'healthy' | 'stressed' | 'overloaded' | 'idle';
export type RefreshCadence = 'rare' | 'periodic' | 'frequent' | 'continuous';
export type JobCost = 'light' | 'medium' | 'heavy' | 'very_heavy';
export type BackfillMode = 'off' | 'catch_up' | 'steady' | 'aggressive';
export type RecoveryMode = 'off' | 'startup' | 'rebuild';
export type ProcessingMode = 'batch' | 'stream';
export type ReplicationMode = 'single_leader' | 'leader_follower';
export type HealthState = 'healthy' | 'degraded' | 'unavailable';
export type ConsistencyModel = 'strong' | 'read-your-writes' | 'bounded-staleness' | 'eventual';

export interface NodeData {
  type: NodeType;
  label: string;
  implementationLabel?: string;
  instances: number;
  maxCapacityPerInstance: number; // work units/sec per instance
  currentLoad: number;            // total work units/sec hitting this node
  status: NodeStatus;
  // Failure injection
  healthState?: HealthState;
  // Latency (populated on client node after simulation)
  latencyP50Ms?: number;
  latencyP99Ms?: number;
  // Replication (populated on DB nodes)
  replicationLagMs?: number;
  stalenessRisk?: boolean;
  consistencyModel?: ConsistencyModel;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  goal: string;
  hint?: string;
  successCriteria: (nodes: Node<NodeData>[]) => boolean;
  initialState: {
    system: 'starter' | 'pickgpu';
    params?: Partial<SimulationParams>;
    nodeHealth?: Record<string, HealthState>;
    nodeCounts?: Record<string, number>;
    nodeCapacities?: Record<string, number>;
  };
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
  cacheWorkingSetFit: number; // 0-1 fit between cacheable working set and cache capacity
  cacheInvalidationRate: number; // 0-1 write-driven cache churn
  serviceFanout: number; // downstream calls per request
  sourceJobTypes: number; // number of distinct scheduled source workflows
  refreshCadence: RefreshCadence; // how often freshness-sensitive source jobs run
  queueDepth: number; // 0-1 backlog / burst pressure on async work
  averageJobCost: JobCost; // average compute/IO work per job run
  retryRate: number; // 0-1 retry amplification for failed async work
  batchSize: number; // abstract batch width for workers
  derivedStateCadence: RefreshCadence; // how often serving state is refreshed from durable inputs
  backfillMode: BackfillMode; // deferred historical processing intensity
  recoveryMode: RecoveryMode; // recovery / replay intensity
  processorLag: number; // 0-1 backlog in derived-state processing
  processingMode: ProcessingMode; // batch vs stream orientation
  databaseShardCount: number; // shard / partition count for write scaling
  nosqlPartitionCount: number; // partition count for nosql scaling
  databaseWriteLoad: number; // 0-1 write intensity relative to read volume
  relationalReplicationMode: ReplicationMode; // explicit leader/follower replication mode
  objectStoreThroughput: number; // 0-1 request budget / throughput headroom
  objectStoreScanCost: number; // 0-1 cost of large scans / replays against object storage
  maxBackgroundConcurrency: number; // abstract parallelism budget for background work
  enableApiPriorityGate: boolean;
}

export interface UserEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  kind: 'request' | 'data';
}

export interface SharedConfig {
  v: 1;
  currentSystem: 'starter' | 'pickgpu' | 'custom';
  params: SimulationParams;
  nodeCounts: Record<string, number>;
  nodeCapacities: Record<string, number>;
  nodeLabels: Record<string, string>;
  implementationLabels: Record<string, string>;
  enabledLayers: string[];
  deletedEdgeIds: string[];
  userAddedEdges: UserEdge[];
  customNodePositions: Record<string, { x: number; y: number }>;
  nodeHealth?: Record<string, HealthState>;
  consistencyModels?: Record<string, ConsistencyModel>;
}

// Snapshot of source-of-truth state (excludes derived nodes/edges and UI state)
export type SimulationSnapshot = SimulationParams & {
  nodeCounts: Record<string, number>;
  nodeCapacities: Record<string, number>;
  nodeLabels: Record<string, string>;
  implementationLabels: Record<string, string>;
  enabledLayers: string[];
  deletedEdgeIds: string[];
  userAddedEdges: UserEdge[];
  customNodePositions: Record<string, { x: number; y: number }>;
  currentSystem: 'starter' | 'pickgpu' | 'custom';
  nodeHealth: Record<string, HealthState>;
  consistencyModels: Record<string, ConsistencyModel>;
};

export interface SimulationStore extends SimulationParams {
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  nodeCounts: Record<string, number>;
  nodeCapacities: Record<string, number>;
  currentSystem: 'starter' | 'pickgpu' | 'custom';
  expandedNodeId: string | null;
  showNodeConfig: boolean;
  nodeLabels: Record<string, string>;
  implementationLabels: Record<string, string>;
  enabledLayers: string[];
  savedNodeCounts: Record<string, number>;
  deletedEdgeIds: string[];
  userAddedEdges: UserEdge[];
  customNodePositions: Record<string, { x: number; y: number }>;
  past: SimulationSnapshot[];
  future: SimulationSnapshot[];
  nodeHealth: Record<string, HealthState>;
  consistencyModels: Record<string, ConsistencyModel>;
  activeScenario: Scenario | null;

  // Actions
  updateSimParams: (params: Partial<SimulationParams>) => void;
  updateNodeInstances: (nodeId: string, instances: number) => void;
  updateNodeCapacity: (nodeId: string, capacity: number) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  updateImplementationLabel: (nodeId: string, label: string) => void;
  setExpandedNodeId: (id: string | null) => void;
  toggleNodeConfig: () => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  addUserEdge: (connection: Connection, kind: 'request' | 'data') => void;
  updateEdgeKind: (edgeId: string, kind: 'request' | 'data') => void;
  addNode: (type: NodeType) => void;
  refreshAutoLayout: () => void;
  runSimulation: () => void;
  loadStarterSystem: () => void;
  loadPickGPUSystem: () => void;
  loadCustomSystem: (enabledLayerIds: string[], autoConnect?: boolean) => void;
  setLayerEnabled: (layerId: string, enabled: boolean) => void;
  hydrateFromConfig: (cfg: SharedConfig) => void;
  undo: () => void;
  redo: () => void;
  setNodeHealth: (nodeId: string, health: HealthState) => void;
  setConsistencyModel: (nodeId: string, model: ConsistencyModel) => void;
  loadScenario: (scenario: Scenario) => void;
  exitScenario: () => void;
}
