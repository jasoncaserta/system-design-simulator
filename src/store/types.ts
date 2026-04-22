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
  onConnect: (connection: Connection) => void;
  runSimulation: () => void;
  loadStarterSystem: () => void;
  loadPickGPUSystem: () => void;
}
