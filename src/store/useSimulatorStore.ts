import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import type {
  Connection,
  Edge,
  Node,
  NodeChange,
  NodePositionChange,
  EdgeChange,
  XYPosition,
} from 'reactflow';
import type {
  SimulationStore,
  SimulationParams,
  SimulationSnapshot,
  SharedConfig,
  UserEdge,
  NodeData,
  EdgeData,
  NodeType,
  NodeStatus,
  RefreshCadence,
  JobCost,
  BackfillMode,
  RecoveryMode,
  ReplicationMode,
} from './types';
import { layoutGraphNodes } from '../utils/autoLayout';

const BACKGROUND_TIERS = new Set(['message-queue', 'worker', 'object-store', 'batch-processor']);

const CORE_TIERS = new Set(['client', 'load-balancer', 'service', 'cache', 'relational-db']);

interface LayerDef {
  id: string;
  type: NodeType;
  label: string;
  implementationLabel: string;
  x: number;
  y: number;
}

interface EdgeRoute {
  sourceHandle?: string;
  targetHandle?: string;
}

interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeData['kind'];
}

const INITIAL_PARAMS: SimulationParams = {
  users: 1000,
  rpsPerUser: 0.1,
  readWriteRatio: 0.8,
  cacheHitRate: 0.8,
  cdnHitRate: 0,
  cacheWorkingSetFit: 0.8,
  cacheInvalidationRate: 0.2,
  serviceFanout: 1,
  sourceJobTypes: 0,
  refreshCadence: 'rare',
  queueDepth: 0.1,
  averageJobCost: 'medium',
  retryRate: 0.05,
  batchSize: 2,
  derivedStateCadence: 'rare',
  backfillMode: 'off',
  recoveryMode: 'off',
  processorLag: 0.1,
  processingMode: 'batch',
  databaseShardCount: 1,
  nosqlPartitionCount: 2,
  databaseWriteLoad: 0.25,
  relationalReplicationMode: 'leader_follower',
  objectStoreThroughput: 0.6,
  objectStoreScanCost: 0.2,
  maxBackgroundConcurrency: 1,
  enableApiPriorityGate: true,
};

const INITIAL_COUNTS = {
  client: 1,
  'load-balancer': 1,
  service: 1,
  cache: 1,
  'relational-db': 1,
  'nosql-db': 0,
  cdn: 0,
  'message-queue': 0,
  worker: 0,
  'object-store': 0,
  'batch-processor': 0,
};

const INITIAL_CAPACITIES = {
  client: 1000000,
  'load-balancer': 5000,
  service: 250,
  cache: 25000,
  'relational-db': 500,
  'nosql-db': 900,
  cdn: 100000,
  'message-queue': 400,
  worker: 80,
  'object-store': 1500,
  'batch-processor': 200,
};

const LAYERS: LayerDef[] = [
  { id: 'client', type: 'client', label: 'CLIENTS', implementationLabel: 'Browsers', x: 0, y: 0 },
  { id: 'cdn', type: 'cdn', label: 'EDGE CACHE', implementationLabel: 'CDN', x: 1, y: 0 },
  { id: 'load-balancer', type: 'load-balancer', label: 'REQUEST ROUTER', implementationLabel: 'Nginx / Envoy', x: 2, y: 0 },
  { id: 'message-queue', type: 'message-queue', label: 'MESSAGE QUEUE', implementationLabel: 'Kafka / RabbitMQ', x: 2, y: 0.9 },
  { id: 'service', type: 'service', label: 'STATELESS SERVICE', implementationLabel: 'API Service', x: 3, y: 0 },
  { id: 'worker', type: 'worker', label: 'WORKERS', implementationLabel: 'Async Workers', x: 3, y: 1.24 },
  { id: 'cache', type: 'cache', label: 'SERVING CACHE', implementationLabel: 'Redis / Memcached', x: 4, y: 0.385 },
  { id: 'object-store', type: 'object-store', label: 'DURABLE STORE', implementationLabel: 'S3 / GCS', x: 4, y: 1.24 },
  { id: 'relational-db', type: 'relational-db', label: 'DATABASE', implementationLabel: 'PostgreSQL / MySQL', x: 5, y: 0 },
  { id: 'nosql-db', type: 'nosql-db', label: 'NOSQL DB', implementationLabel: 'Cassandra / MongoDB', x: 6, y: 0.08 },
  { id: 'batch-processor', type: 'batch-processor', label: 'BATCH PROCESSOR', implementationLabel: 'Spark / Flink / Batch Jobs', x: 7, y: 0.95 },
];

const LAYER_BY_ID = new Map(LAYERS.map((layer) => [layer.id, layer]));

const PICKGPU_NODE_LABELS: Record<string, string> = {
  'load-balancer': 'REQUEST ROUTER',
  'message-queue': 'JOB SCHEDULER',
  cache: 'SERVING CACHE',
  'object-store': 'DURABLE STORE',
  'relational-db': 'SERVING DATABASE',
};

const PICKGPU_IMPLEMENTATION_LABELS: Record<string, string> = {
  cdn: 'Cloudflare',
  'load-balancer': 'Nginx',
  'message-queue': 'APScheduler + QueueManager',
  service: 'FastAPI + Uvicorn',
  worker: 'Source Jobs + Scrapers',
  cache: 'In-Process Cache',
  'object-store': 'Export CSV Repo',
  'relational-db': 'SQLite',
  'batch-processor': 'Cross-Market Rescore + History Rebuild',
};

const distribute = (
  nodeMap: Map<string, Node<NodeData>>,
  tierId: string,
  load: number,
) => {
  const node = nodeMap.get(tierId);
  if (!node || load <= 0) return;
  node.data.currentLoad += load;
};

const sumLoads = (...loads: number[]) => loads.reduce((acc, load) => acc + load, 0);

/** Generate sensible default edges for a custom system based on which node types are enabled. */
function buildDefaultEdges(enabledIds: string[]): UserEdge[] {
  const has = (id: string) => enabledIds.includes(id);
  const edges: UserEdge[] = [];
  const getAutoRoute = (source: string, target: string): EdgeRoute => {
    const sourceLayer = LAYER_BY_ID.get(source);
    const targetLayer = LAYER_BY_ID.get(target);
    if (!sourceLayer || !targetLayer) {
      return { sourceHandle: 'source-right', targetHandle: 'target-left' };
    }

    const dx = targetLayer.x - sourceLayer.x;
    const dy = targetLayer.y - sourceLayer.y;

    if (Math.abs(dx) < 0.2) {
      return dy >= 0
        ? { sourceHandle: 'source-bottom', targetHandle: 'target-top' }
        : { sourceHandle: 'source-top', targetHandle: 'target-bottom' };
    }

    if (dx > 0) {
      if (dy > 0.25) {
        return { sourceHandle: 'source-right-lower', targetHandle: 'target-left-upper' };
      }
      if (dy < -0.25) {
        return { sourceHandle: 'source-right-upper', targetHandle: 'target-left-lower' };
      }
      return { sourceHandle: 'source-right', targetHandle: 'target-left' };
    }

    if (dy > 0.25) {
      return { sourceHandle: 'source-left', targetHandle: 'target-top-right' };
    }
    if (dy < -0.25) {
      return { sourceHandle: 'source-left', targetHandle: 'target-bottom' };
    }
    return { sourceHandle: 'source-left', targetHandle: 'target-right' };
  };

  const edge = (source: string, target: string, kind: 'request' | 'data') => {
    if (has(source) && has(target)) {
      edges.push({
        id: `user-${source}-${target}-${kind}`,
        source,
        target,
        kind,
        ...getAutoRoute(source, target),
      });
    }
  };
  // Ingress path
  if (has('cdn')) {
    edge('client', 'cdn', 'request');
    edge('cdn', 'load-balancer', 'request');
  } else {
    edge('client', 'load-balancer', 'request');
  }
  edge('load-balancer', 'service', 'request');
  // Serving
  edge('service', 'cache', 'request');
  edge('cache', 'nosql-db', 'request');
  edge('cache', 'relational-db', 'request');
  edge('service', 'relational-db', 'data');
  // Background pipeline
  edge('service', 'message-queue', 'data');
  edge('message-queue', 'worker', 'data');
  edge('message-queue', 'batch-processor', 'data');
  edge('worker', 'object-store', 'data');
  edge('object-store', 'batch-processor', 'data');
  edge('batch-processor', 'nosql-db', 'data');
  edge('batch-processor', 'relational-db', 'data');
  return edges;
}

function buildPresetTopologyEdges(enabledIds: string[]): TopologyEdge[] {
  const has = (id: string) => enabledIds.includes(id);
  const edges: TopologyEdge[] = [];
  const edge = (source: string, target: string, kind: EdgeData['kind']) => {
    if (!has(source) || !has(target)) return;
    edges.push({ id: `e-${source}-${target}-${kind}`, source, target, kind });
  };

  if (has('cdn')) {
    edge('client', 'cdn', 'request');
    edge('cdn', 'load-balancer', 'request');
  } else {
    edge('client', 'load-balancer', 'request');
  }

  edge('load-balancer', 'service', 'request');
  edge('service', 'cache', 'request');
  edge('cache', has('nosql-db') ? 'nosql-db' : 'relational-db', 'request');
  if (has('nosql-db')) {
    edge('cache', 'relational-db', 'request');
  }
  edge('service', 'relational-db', 'data');
  edge('message-queue', 'worker', 'data');
  edge('worker', 'object-store', 'data');
  edge('message-queue', 'batch-processor', 'data');
  edge('object-store', 'batch-processor', 'data');
  edge('batch-processor', has('nosql-db') ? 'nosql-db' : 'relational-db', 'data');

  return edges;
}

function buildAutoLayoutPositions(
  currentSystem: SimulationStore['currentSystem'],
  activeLayers: LayerDef[],
  userAddedEdges: UserEdge[],
  deletedEdgeIds: string[],
  existingNodes: Node<NodeData>[],
): Record<string, XYPosition> {
  const activeIds = new Set(activeLayers.map((layer) => layer.id));
  const deletedIds = new Set(deletedEdgeIds);
  const existingNodeMap = new Map(existingNodes.map((node) => [node.id, node]));
  const orderedNodes = activeLayers.map((layer, order) => {
    const measured = existingNodeMap.get(layer.id);
    return {
      id: layer.id,
      order,
      width: measured?.width ?? undefined,
      height: measured?.height ?? undefined,
    };
  });

  const layoutEdges = currentSystem === 'custom'
    ? userAddedEdges
        .filter((edge) => activeIds.has(edge.source) && activeIds.has(edge.target))
        .map((edge) => ({ source: edge.source, target: edge.target, kind: edge.kind }))
    : [
        ...buildPresetTopologyEdges(Array.from(activeIds))
          .filter((edge) => !deletedIds.has(edge.id))
          .map((edge) => ({ source: edge.source, target: edge.target, kind: edge.kind })),
        ...userAddedEdges
          .filter((edge) => activeIds.has(edge.source) && activeIds.has(edge.target) && !deletedIds.has(edge.id))
          .map((edge) => ({ source: edge.source, target: edge.target, kind: edge.kind })),
      ];

  return layoutGraphNodes(orderedNodes, layoutEdges);
}

const PICKGPU_NODE_COUNTS = {
  client: 1,
  cdn: 1,
  'load-balancer': 1,
  service: 1,
  cache: 1,
  'relational-db': 1,
  'nosql-db': 0,
  'message-queue': 1,
  worker: 1,
  'object-store': 1,
  'batch-processor': 1,
} as const;

const PICKGPU_NODE_CAPACITIES = {
  client: 1000000,
  cdn: 100000,
  'load-balancer': 5000,
  service: 200,
  cache: 5000,
  'relational-db': 120,
  'nosql-db': 220,
  'message-queue': 40,
  worker: 25,
  'object-store': 1200,
  'batch-processor': 150,
} as const;

const CADENCE_CONFIG: Record<RefreshCadence, { sourceRate: number; schedulerRate: number; derivedRate: number }> = {
  rare: { sourceRate: 0.6, schedulerRate: 0.5, derivedRate: 0.4 },
  periodic: { sourceRate: 1.0, schedulerRate: 0.9, derivedRate: 0.8 },
  frequent: { sourceRate: 1.5, schedulerRate: 1.3, derivedRate: 1.2 },
  continuous: { sourceRate: 2.2, schedulerRate: 1.8, derivedRate: 1.7 },
};

const JOB_COST_CONFIG: Record<JobCost, { worker: number; scheduler: number; derived: number; history: number; recovery: number }> = {
  light: { worker: 0.8, scheduler: 0.9, derived: 0.75, history: 0.8, recovery: 0.8 },
  medium: { worker: 1.0, scheduler: 1.0, derived: 1.0, history: 1.0, recovery: 1.0 },
  heavy: { worker: 1.35, scheduler: 1.15, derived: 1.3, history: 1.25, recovery: 1.2 },
  very_heavy: { worker: 1.75, scheduler: 1.35, derived: 1.65, history: 1.55, recovery: 1.45 },
};

const BACKFILL_MODE_CONFIG: Record<BackfillMode, { pressure: number; schedulerRate: number }> = {
  off: { pressure: 0, schedulerRate: 0 },
  catch_up: { pressure: 4, schedulerRate: 0.8 },
  steady: { pressure: 10, schedulerRate: 1.2 },
  aggressive: { pressure: 18, schedulerRate: 1.7 },
};

const RECOVERY_MODE_CONFIG: Record<RecoveryMode, { pressure: number; schedulerRate: number }> = {
  off: { pressure: 0, schedulerRate: 0 },
  startup: { pressure: 22, schedulerRate: 0.8 },
  rebuild: { pressure: 60, schedulerRate: 1.4 },
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getRelationalReadShare = (replicationMode: ReplicationMode, hasNoSql: boolean) => {
  if (!hasNoSql) return replicationMode === 'leader_follower' ? 0.45 : 0.75;
  return replicationMode === 'leader_follower' ? 0.18 : 0.32;
};

const deriveBackgroundLoads = ({
  sourceJobTypes,
  refreshCadence,
  queueDepth,
  averageJobCost,
  retryRate,
  batchSize,
  derivedStateCadence,
  backfillMode,
  recoveryMode,
  processorLag,
  processingMode,
  objectStoreScanCost,
  maxBackgroundConcurrency,
}: Pick<
  SimulationParams,
  | 'sourceJobTypes'
  | 'refreshCadence'
  | 'queueDepth'
  | 'averageJobCost'
  | 'retryRate'
  | 'batchSize'
  | 'derivedStateCadence'
  | 'backfillMode'
  | 'recoveryMode'
  | 'processorLag'
  | 'processingMode'
  | 'objectStoreScanCost'
  | 'maxBackgroundConcurrency'
>) => {
  const cadence = CADENCE_CONFIG[refreshCadence];
  const derivedCadence = CADENCE_CONFIG[derivedStateCadence];
  const jobCost = JOB_COST_CONFIG[averageJobCost];
  const backfill = BACKFILL_MODE_CONFIG[backfillMode];
  const recovery = RECOVERY_MODE_CONFIG[recoveryMode];
  const concurrencyFactor = clamp(0.75 + maxBackgroundConcurrency * 0.15, 0.75, 1.8);
  const retryAmplification = 1 + retryRate * 1.8;
  const queueDepthFactor = 1 + queueDepth * 1.2;
  const batchEfficiency = clamp(1 + (batchSize - 1) * 0.12, 1, 1.84);
  const lagFactor = 1 + processorLag * 1.5;
  const scanFactor = 1 + objectStoreScanCost * 1.2;
  const modeSchedulerFactor = processingMode === 'stream' ? 1.18 : 0.92;
  const modeProcessorFactor = processingMode === 'stream' ? 0.88 : 1.08;

  const sourceFreshnessPressure =
    sourceJobTypes * cadence.sourceRate * jobCost.worker * concurrencyFactor * retryAmplification * queueDepthFactor / batchEfficiency;

  const derivedRefreshLoad = Math.max(
    sourceJobTypes * 0.6,
    sourceJobTypes * derivedCadence.derivedRate * jobCost.derived * 1.5 * concurrencyFactor * modeProcessorFactor,
  ) * lagFactor * scanFactor;
  const backfillLoad =
    backfill.pressure *
    jobCost.history *
    clamp(0.7 + maxBackgroundConcurrency * 0.08, 0.7, 1.3) *
    lagFactor *
    scanFactor *
    modeProcessorFactor;
  const recoveryLoad = recovery.pressure * jobCost.recovery * lagFactor * scanFactor * modeProcessorFactor;
  const processorLoad = sumLoads(derivedRefreshLoad, backfillLoad, recoveryLoad);

  const schedulerCoordinationLoad = sumLoads(
    sourceJobTypes * cadence.schedulerRate * jobCost.scheduler,
    Math.max(1, sourceJobTypes * 0.4) * derivedCadence.schedulerRate,
    backfill.schedulerRate,
    recovery.schedulerRate,
  ) * concurrencyFactor * queueDepthFactor * retryAmplification * modeSchedulerFactor / batchEfficiency;

  return {
    sourceFreshnessPressure,
    processorLoad,
    schedulerCoordinationLoad,
  };
};

const buildPickGPUDefaults = () => {
  const nodeCapacities = { ...PICKGPU_NODE_CAPACITIES };

  return {
    nodeCounts: { ...PICKGPU_NODE_COUNTS },
    nodeCapacities,
    users: 1000,
    rpsPerUser: 0.1,
    readWriteRatio: 0.95,
    cacheHitRate: 0.7,
    cdnHitRate: 0.9,
    sourceJobTypes: 4,
    refreshCadence: 'periodic' as const,
    queueDepth: 0.25,
    averageJobCost: 'medium' as const,
    retryRate: 0.06,
    batchSize: 3,
    derivedStateCadence: 'periodic' as const,
    backfillMode: 'off' as const,
    recoveryMode: 'off' as const,
    processorLag: 0.15,
    processingMode: 'batch' as const,
    cacheWorkingSetFit: 0.7,
    cacheInvalidationRate: 0.25,
    serviceFanout: 2,
    databaseShardCount: 1,
    nosqlPartitionCount: 1,
    databaseWriteLoad: 0.35,
    relationalReplicationMode: 'single_leader' as const,
    objectStoreThroughput: 0.65,
    objectStoreScanCost: 0.25,
    maxBackgroundConcurrency: 2,
    enableApiPriorityGate: true,
  };
};

const STARTER_ENABLED_LAYERS = ['client', 'load-balancer', 'service', 'cache', 'relational-db'];
const PICKGPU_ENABLED_LAYERS = ['client', 'cdn', 'load-balancer', 'service', 'cache', 'relational-db', 'message-queue', 'worker', 'object-store', 'batch-processor'];
const ALL_LAYER_IDS = LAYERS.map((l) => l.id);

const MAX_HISTORY = 50;

/** Capture a snapshot of source-of-truth state from the store's get() accessor. */
const captureSnapshot = (s: SimulationStore): SimulationSnapshot => ({
  users: s.users, rpsPerUser: s.rpsPerUser, readWriteRatio: s.readWriteRatio,
  cacheHitRate: s.cacheHitRate, cdnHitRate: s.cdnHitRate,
  cacheWorkingSetFit: s.cacheWorkingSetFit, cacheInvalidationRate: s.cacheInvalidationRate,
  serviceFanout: s.serviceFanout, sourceJobTypes: s.sourceJobTypes,
  refreshCadence: s.refreshCadence, queueDepth: s.queueDepth,
  averageJobCost: s.averageJobCost, retryRate: s.retryRate, batchSize: s.batchSize,
  derivedStateCadence: s.derivedStateCadence, backfillMode: s.backfillMode,
  recoveryMode: s.recoveryMode, processorLag: s.processorLag,
  processingMode: s.processingMode, databaseShardCount: s.databaseShardCount,
  nosqlPartitionCount: s.nosqlPartitionCount, databaseWriteLoad: s.databaseWriteLoad,
  relationalReplicationMode: s.relationalReplicationMode,
  objectStoreThroughput: s.objectStoreThroughput, objectStoreScanCost: s.objectStoreScanCost,
  maxBackgroundConcurrency: s.maxBackgroundConcurrency, enableApiPriorityGate: s.enableApiPriorityGate,
  nodeCounts: { ...s.nodeCounts }, nodeCapacities: { ...s.nodeCapacities },
  nodeLabels: { ...s.nodeLabels }, implementationLabels: { ...s.implementationLabels },
  enabledLayers: [...s.enabledLayers], deletedEdgeIds: [...s.deletedEdgeIds],
  userAddedEdges: [...s.userAddedEdges], customNodePositions: { ...s.customNodePositions },
  currentSystem: s.currentSystem,
});

export const useSimulatorStore = create<SimulationStore>((set, get) => {
  /** Push current state to undo history and clear redo stack. */
  const pushHistory = () => {
    const snapshot = captureSnapshot(get());
    set((state) => ({
      past: [...state.past, snapshot].slice(-MAX_HISTORY),
      future: [],
    }));
  };

  return ({
  ...INITIAL_PARAMS,
  nodeCounts: { ...INITIAL_COUNTS },
  nodeCapacities: { ...INITIAL_CAPACITIES },
  nodes: [],
  edges: [],
  currentSystem: 'starter',
  expandedNodeId: null,
  showNodeConfig: true,
  nodeLabels: {},
  implementationLabels: {},
  enabledLayers: [...STARTER_ENABLED_LAYERS],
  savedNodeCounts: {},
  deletedEdgeIds: [],
  userAddedEdges: [],
  customNodePositions: {},
  past: [],
  future: [],

  updateNodeLabel: (nodeId, label) => {
    pushHistory();
    set((state) => ({
      nodeLabels: { ...state.nodeLabels, [nodeId]: label },
    }));
    get().runSimulation();
  },

  updateImplementationLabel: (nodeId, label) => {
    pushHistory();
    set((state) => ({
      implementationLabels: { ...state.implementationLabels, [nodeId]: label },
    }));
    get().runSimulation();
  },

  toggleNodeConfig: () => {
    set((state) => ({ showNodeConfig: !state.showNodeConfig }));
  },

  setExpandedNodeId: (id) => {
    set((state) => ({
      expandedNodeId: state.expandedNodeId === id ? null : id,
    }));
  },

  updateSimParams: (params) => {
    pushHistory();
    set({ ...params, currentSystem: 'custom' });
    get().runSimulation();
  },

  updateNodeInstances: (tierId, instances) => {
    pushHistory();
    const cleanTierId = tierId.replace(/-[0-9]+$/, '');
    const minInstances = CORE_TIERS.has(cleanTierId) ? 1 : 0;
    set((state) => ({
      nodeCounts: {
        ...state.nodeCounts,
        [cleanTierId]: Math.max(minInstances, instances),
      },
      currentSystem: 'custom',
    }));
    get().runSimulation();
  },

  updateNodeCapacity: (tierId, capacity) => {
    pushHistory();
    const cleanTierId = tierId.replace(/-[0-9]+$/, '');
    set((state) => ({
      nodeCapacities: {
        ...state.nodeCapacities,
        [cleanTierId]: Math.max(1, capacity),
      },
      currentSystem: 'custom',
    }));
    get().runSimulation();
  },

  onNodesChange: (changes: NodeChange[]) => {
    const dragEndIds = changes
      .filter((c): c is NodePositionChange => c.type === 'position' && c.dragging === false)
      .map((c) => c.id);

    if (dragEndIds.length > 0) {
      pushHistory();
      set((state) => {
        const updatedNodes = applyNodeChanges(changes, state.nodes);
        const posUpdates: Record<string, XYPosition> = {};
        dragEndIds.forEach((id) => {
          const node = updatedNodes.find((n) => n.id === id);
          if (node?.position) posUpdates[id] = node.position;
        });
        return {
          nodes: updatedNodes,
          customNodePositions: { ...state.customNodePositions, ...posUpdates },
        };
      });
      return;
    }
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }));
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    const removedIds = changes.filter((c) => c.type === 'remove').map((c) => c.id);
    if (removedIds.length > 0) {
      pushHistory();
      set((state) => {
        const simRemovedIds = removedIds.filter((id) => !state.userAddedEdges.some((e) => e.id === id));
        return {
          edges: applyEdgeChanges(changes, state.edges),
          deletedEdgeIds: simRemovedIds.length > 0
            ? [...new Set([...state.deletedEdgeIds, ...simRemovedIds])]
            : state.deletedEdgeIds,
          userAddedEdges: state.userAddedEdges.filter((e) => !removedIds.includes(e.id)),
          currentSystem: 'custom',
        };
      });
      get().runSimulation();
    } else {
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
      }));
    }
  },

  addUserEdge: (connection: Connection, kind: 'request' | 'data') => {
    pushHistory();
    const id = `user-${connection.source}-${connection.target}-${kind}`;
    const userEdge: UserEdge = {
      id,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
      kind,
    };
    set((state) => ({
      userAddedEdges: [
        ...state.userAddedEdges.filter((e) => !(e.source === connection.source && e.target === connection.target)),
        userEdge,
      ],
      deletedEdgeIds: state.deletedEdgeIds.filter((did) => did !== id),
    }));
    get().runSimulation();
  },

  updateEdgeKind: (edgeId: string, kind: 'request' | 'data') => {
    const existingEdge = get().userAddedEdges.find((edge) => edge.id === edgeId);
    if (!existingEdge || existingEdge.kind === kind) return;

    pushHistory();
    set((state) => {
      const nextId = `user-${existingEdge.source}-${existingEdge.target}-${kind}`;

      return {
        userAddedEdges: state.userAddedEdges.map((edge) =>
          edge.id === edgeId
            ? { ...edge, id: nextId, kind }
            : edge
        ),
        deletedEdgeIds: state.deletedEdgeIds.filter((id) => id !== nextId),
        currentSystem: 'custom',
      };
    });
    get().runSimulation();
  },

  addNode: (type: NodeType) => {
    pushHistory();
    const layer = LAYERS.find((l) => l.type === type);
    if (!layer) return;
    const state = get();
    // Already present — just enable it
    if ((state.nodeCounts[layer.id] || 0) >= 1) {
      if (!state.enabledLayers.includes(layer.id)) {
        set((s) => ({
          nodeCounts: { ...s.nodeCounts, [layer.id]: 1 },
          enabledLayers: [...s.enabledLayers, layer.id],
        }));
        get().runSimulation();
      }
      return;
    }
    // Compute a default position offset from existing nodes
    const positions = Object.values(state.customNodePositions);
    const maxX = positions.length > 0 ? Math.max(...positions.map((p) => p.x)) : -320;
    const defaultPos: XYPosition = { x: maxX + 320, y: layer.y * 240 };
    set((s) => ({
      nodeCounts: { ...s.nodeCounts, [layer.id]: INITIAL_COUNTS[layer.id as keyof typeof INITIAL_COUNTS] || 1 },
      enabledLayers: s.enabledLayers.includes(layer.id) ? s.enabledLayers : [...s.enabledLayers, layer.id],
      customNodePositions: { ...s.customNodePositions, [layer.id]: s.customNodePositions[layer.id] ?? defaultPos },
    }));
    get().runSimulation();
  },

  refreshAutoLayout: () => {
    set({ customNodePositions: {} });
    get().runSimulation();
  },

  loadStarterSystem: () => {
    pushHistory();
    set({
      nodeCounts: {
        client: 1,
        'load-balancer': 1,
        service: 1,
        cache: 1,
        'relational-db': 1,
        'nosql-db': 0,
        cdn: 0,
        'message-queue': 0,
        worker: 0,
        'object-store': 0,
        'batch-processor': 0,
      },
      nodeCapacities: { ...INITIAL_CAPACITIES },
      ...INITIAL_PARAMS,
      currentSystem: 'starter',
      expandedNodeId: null,
      nodeLabels: {},
      implementationLabels: {},
      enabledLayers: [...STARTER_ENABLED_LAYERS],
      savedNodeCounts: {},
      deletedEdgeIds: [],
      userAddedEdges: [],
      customNodePositions: {},
    });
    get().runSimulation();
  },

  loadPickGPUSystem: () => {
    pushHistory();
    const pickGPUDefaults = buildPickGPUDefaults();
    set({
      ...pickGPUDefaults,
      currentSystem: 'pickgpu',
      expandedNodeId: null,
      nodeLabels: { ...PICKGPU_NODE_LABELS },
      implementationLabels: { ...PICKGPU_IMPLEMENTATION_LABELS },
      enabledLayers: [...PICKGPU_ENABLED_LAYERS],
      savedNodeCounts: {},
      deletedEdgeIds: [],
      userAddedEdges: [],
      customNodePositions: {},
    });
    get().runSimulation();
  },

  loadCustomSystem: (enabledLayerIds: string[], autoConnect = false) => {
    pushHistory();
    const counts: Record<string, number> = {};
    ALL_LAYER_IDS.forEach((id) => {
      counts[id] = enabledLayerIds.includes(id) ? (INITIAL_COUNTS[id as keyof typeof INITIAL_COUNTS] || 1) : 0;
    });
    counts['client'] = 1;

    const orderedLayers = LAYERS.filter((l) => counts[l.id] > 0);
    const userAddedEdges = autoConnect ? buildDefaultEdges(enabledLayerIds.concat(['client'])) : [];
    const initialPositions = layoutGraphNodes(
      orderedLayers.map((layer, order) => ({ id: layer.id, order })),
      userAddedEdges.map((edge) => ({ source: edge.source, target: edge.target, kind: edge.kind })),
    );

    set({
      ...INITIAL_PARAMS,
      nodeCounts: counts,
      nodeCapacities: { ...INITIAL_CAPACITIES },
      currentSystem: 'custom',
      expandedNodeId: null,
      nodeLabels: {},
      implementationLabels: {},
      enabledLayers: [...enabledLayerIds],
      savedNodeCounts: {},
      deletedEdgeIds: [],
      userAddedEdges,
      customNodePositions: initialPositions,
    });
    get().runSimulation();
  },

  setLayerEnabled: (layerId: string, enabled: boolean) => {
    pushHistory();
    const state = get();
    if (enabled) {
      const restored = state.savedNodeCounts[layerId] ?? INITIAL_COUNTS[layerId as keyof typeof INITIAL_COUNTS] ?? 1;
      set((s) => ({
        nodeCounts: { ...s.nodeCounts, [layerId]: restored },
        enabledLayers: s.enabledLayers.includes(layerId) ? s.enabledLayers : [...s.enabledLayers, layerId],
        currentSystem: 'custom',
      }));
    } else {
      const currentCount = state.nodeCounts[layerId] ?? 0;
      set((s) => ({
        nodeCounts: { ...s.nodeCounts, [layerId]: 0 },
        savedNodeCounts: { ...s.savedNodeCounts, [layerId]: currentCount },
        enabledLayers: s.enabledLayers.filter((id) => id !== layerId),
        currentSystem: 'custom',
      }));
    }
    get().runSimulation();
  },

  hydrateFromConfig: (cfg: SharedConfig) => {
    set({
      ...cfg.params,
      nodeCounts: { ...cfg.nodeCounts },
      nodeCapacities: { ...cfg.nodeCapacities },
      nodeLabels: { ...cfg.nodeLabels },
      implementationLabels: { ...cfg.implementationLabels },
      enabledLayers: [...cfg.enabledLayers],
      deletedEdgeIds: [...(cfg.deletedEdgeIds ?? [])],
      userAddedEdges: [...(cfg.userAddedEdges ?? [])],
      customNodePositions: { ...(cfg.customNodePositions ?? {}) },
      savedNodeCounts: {},
      currentSystem: cfg.currentSystem ?? 'custom',
      expandedNodeId: null,
    });
    get().runSimulation();
  },

  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const current = captureSnapshot(get());
    set({
      ...prev,
      past: past.slice(0, -1),
      future: [current, ...future].slice(0, MAX_HISTORY),
      expandedNodeId: null,
    });
    get().runSimulation();
  },

  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return;
    const next = future[0];
    const current = captureSnapshot(get());
    set({
      ...next,
      past: [...past, current].slice(-MAX_HISTORY),
      future: future.slice(1),
      expandedNodeId: null,
    });
    get().runSimulation();
  },

  runSimulation: () => {
    const {
      users,
      rpsPerUser,
      readWriteRatio,
      cacheHitRate,
      cdnHitRate,
      cacheWorkingSetFit,
      cacheInvalidationRate,
      serviceFanout,
      sourceJobTypes,
      refreshCadence,
      queueDepth,
      averageJobCost,
      retryRate,
      batchSize,
      derivedStateCadence,
      backfillMode,
      recoveryMode,
      processorLag,
      processingMode,
      databaseShardCount,
      nosqlPartitionCount,
      databaseWriteLoad,
      relationalReplicationMode,
      objectStoreThroughput,
      objectStoreScanCost,
      maxBackgroundConcurrency,
      enableApiPriorityGate,
      nodeCounts,
      nodeCapacities,
      nodeLabels,
      implementationLabels,
      currentSystem,
      customNodePositions,
      userAddedEdges,
      deletedEdgeIds,
      nodes: existingNodes,
    } = get();

    const totalQps = users * rpsPerUser;
    const activeLayers = LAYERS.filter((layer) => (nodeCounts[layer.id] || 0) > 0);
    const autoLayoutPositions = buildAutoLayoutPositions(
      currentSystem,
      activeLayers,
      userAddedEdges,
      deletedEdgeIds,
      existingNodes,
    );

    const newNodes: Node<NodeData>[] = [];

    activeLayers.forEach((layer) => {
      const count = nodeCounts[layer.id] ?? 0;
      // Use stored position if available (preserves user drags across all system types)
      const position = customNodePositions[layer.id]
        ? customNodePositions[layer.id]
        : autoLayoutPositions[layer.id] ?? { x: 0, y: 0 };

      newNodes.push({
        id: layer.id,
        type: 'custom',
        position,
        data: {
          type: layer.type as NodeType,
          label: nodeLabels[layer.id] ?? layer.label,
          implementationLabel: implementationLabels[layer.id] ?? layer.implementationLabel,
          instances: count,
          maxCapacityPerInstance:
            layer.id === 'relational-db'
              ? nodeCapacities[layer.id] * databaseShardCount
              : layer.id === 'nosql-db'
                ? nodeCapacities[layer.id] * nosqlPartitionCount
              : layer.id === 'object-store'
                ? nodeCapacities[layer.id] * clamp(0.65 + objectStoreThroughput * 1.35, 0.65, 2)
                : nodeCapacities[layer.id],
          currentLoad: 0,
          status: 'healthy',
        },
      });
    });

    // Persist all node positions so reloads restore the layout exactly
    const updatedPositions = { ...customNodePositions };
    newNodes.forEach((n) => { updatedPositions[n.id] = n.position; });

    // ── Custom topology: graph-based load propagation using user-drawn edges ──
    if (currentSystem === 'custom') {
      const nodeMap = new Map(newNodes.map((n) => [n.id, n]));

      // Derive background load for data pipeline edges
      const bgResult = deriveBackgroundLoads({
        sourceJobTypes, refreshCadence, queueDepth, averageJobCost, retryRate,
        batchSize, derivedStateCadence, backfillMode, recoveryMode, processorLag,
        processingMode, objectStoreScanCost, maxBackgroundConcurrency,
      });
      const bgLoad = Math.max(bgResult.sourceFreshnessPressure + bgResult.processorLoad, 1);

      // Build outgoing edge map for user-added edges between existing nodes
      const validEdges = userAddedEdges.filter(
        (e) => nodeMap.has(e.source) && nodeMap.has(e.target),
      );
      const outgoing = new Map<string, UserEdge[]>();
      validEdges.forEach((e) => {
        if (!outgoing.has(e.source)) outgoing.set(e.source, []);
        outgoing.get(e.source)!.push(e);
      });

      // Propagate request load via BFS from client nodes
      const requestTargets = new Set(validEdges.filter((e) => e.kind === 'request').map((e) => e.target));
      const nodeLoad = new Map<string, number>();
      const edgeLoad = new Map<string, number>();

      // Seed: client-type nodes (or nodes with no incoming request edges)
      newNodes.forEach((n) => {
        if (n.data.type === 'client' || !requestTargets.has(n.id)) {
          if (n.data.type === 'client') nodeLoad.set(n.id, totalQps);
        }
      });

      const visited = new Set<string>();
      const queue = newNodes.filter((n) => n.data.type === 'client').map((n) => n.id);

      while (queue.length > 0) {
        const nid = queue.shift()!;
        if (visited.has(nid)) continue;
        visited.add(nid);

        const load = nodeLoad.get(nid) ?? 0;
        const outs = outgoing.get(nid) ?? [];
        const reqOuts = outs.filter((e) => e.kind === 'request');
        const dataOuts = outs.filter((e) => e.kind === 'data');

        if (reqOuts.length > 0) {
          const perEdge = load / reqOuts.length;
          reqOuts.forEach((e) => {
            edgeLoad.set(e.id, perEdge);
            nodeLoad.set(e.target, (nodeLoad.get(e.target) ?? 0) + perEdge);
            if (!visited.has(e.target)) queue.push(e.target);
          });
        }

        if (dataOuts.length > 0) {
          const perEdge = bgLoad / dataOuts.length;
          dataOuts.forEach((e) => {
            edgeLoad.set(e.id, perEdge);
            nodeLoad.set(e.target, (nodeLoad.get(e.target) ?? 0) + perEdge);
            if (!visited.has(e.target)) queue.push(e.target);
          });
        }
      }

      // Apply loads and compute status
      newNodes.forEach((node) => {
        node.data.currentLoad = nodeLoad.get(node.id) ?? 0;
        const cap = node.data.instances * node.data.maxCapacityPerInstance;
        const ratio = cap > 0 ? node.data.currentLoad / cap : 0;
        if (ratio > 1.0) node.data.status = 'overloaded';
        else if (ratio > 0.8) node.data.status = 'stressed';
        else if (node.data.currentLoad === 0) node.data.status = 'idle';
        else node.data.status = 'healthy';
      });

      const customEdges = validEdges.map((ue) => ({
        id: ue.id,
        source: ue.source,
        target: ue.target,
        sourceHandle: ue.sourceHandle,
        targetHandle: ue.targetHandle,
        type: 'custom' as const,
        zIndex: 10,
        data: { throughput: edgeLoad.get(ue.id) ?? 0, kind: ue.kind },
      }));

      set({ nodes: newNodes, edges: customEdges, customNodePositions: updatedPositions });
      return;
    }

    const nodeMap = new Map(newNodes.map((node) => [node.id, node]));

    const readTraffic = totalQps * readWriteRatio;
    const writeTraffic = totalQps * (1 - readWriteRatio);
    const effectiveCacheHitRate = clamp(
      cacheHitRate * (0.55 + cacheWorkingSetFit * 0.75) * (1 - cacheInvalidationRate * 0.35),
      0.05,
      0.98,
    );
    const serviceFanoutFactor = clamp(1 + (serviceFanout - 1) * 0.35, 1, 3.5);
    const hasNoSql = (nodeCounts['nosql-db'] || 0) > 0;
    const relationalReadShare = getRelationalReadShare(relationalReplicationMode, hasNoSql);
    const edgeMisses = readTraffic * (1 - cdnHitRate) + writeTraffic;
    const servingReads = readTraffic * (1 - cdnHitRate);
    const cacheLookups = servingReads * serviceFanoutFactor;
    const dbServingReads = cacheLookups * (1 - effectiveCacheHitRate);
    const relationalReadLoad = dbServingReads * relationalReadShare;
    const nosqlReadLoad = hasNoSql ? dbServingReads - relationalReadLoad : 0;
    const foregroundWriteLoad = writeTraffic * clamp(0.6 + databaseWriteLoad * 1.8, 0.6, 2.4);
    const cacheInvalidationLoad = writeTraffic * cacheInvalidationRate * 0.9;
    const nonDataApiTraffic = writeTraffic * clamp(0.4 + databaseWriteLoad * 0.8, 0.4, 1.2);

    const {
      sourceFreshnessPressure,
      processorLoad,
      schedulerCoordinationLoad,
    } = deriveBackgroundLoads({
      sourceJobTypes,
      refreshCadence,
      queueDepth,
      averageJobCost,
      retryRate,
      batchSize,
      derivedStateCadence,
      backfillMode,
      recoveryMode,
      processorLag,
      processingMode,
      objectStoreScanCost,
      maxBackgroundConcurrency,
    });

    const durableStoreLoad =
      sumLoads(sourceFreshnessPressure, processorLoad) * clamp(0.7 + objectStoreScanCost * 0.6, 0.7, 1.4);
    const backgroundDbWriteDemand = processorLoad * clamp(0.65 + databaseWriteLoad * 0.7, 0.65, 1.35);

    distribute(nodeMap, 'client', totalQps);
    distribute(nodeMap, 'cdn', totalQps);
    distribute(nodeMap, 'load-balancer', edgeMisses);
    distribute(nodeMap, 'service', edgeMisses * clamp(0.8 + serviceFanout * 0.15, 0.8, 2.4));
    distribute(nodeMap, 'cache', cacheLookups + cacheInvalidationLoad);
    distribute(nodeMap, 'relational-db', relationalReadLoad + nonDataApiTraffic + foregroundWriteLoad);
    distribute(nodeMap, 'nosql-db', nosqlReadLoad + processorLoad * 0.35);
    distribute(nodeMap, 'message-queue', schedulerCoordinationLoad);
    distribute(nodeMap, 'worker', sourceFreshnessPressure);
    distribute(nodeMap, 'object-store', durableStoreLoad);
    distribute(nodeMap, 'batch-processor', processorLoad);

    const rawAppCapacity = nodeCounts.service * nodeCapacities.service;
    const totalAppCapacity = Number.isFinite(rawAppCapacity) && rawAppCapacity > 0 ? rawAppCapacity : 1;
    const apiReadPressure = servingReads / totalAppCapacity;
    let gateDrainShare = 1;
    let backgroundStatus: NodeStatus = 'healthy';

    if (enableApiPriorityGate) {
      if (apiReadPressure > 0.9) {
        gateDrainShare = 0.1;
        backgroundStatus = 'overloaded';
      } else if (apiReadPressure > 0.6) {
        gateDrainShare = 0.3;
        backgroundStatus = 'stressed';
      } else if (apiReadPressure > 0.35) {
        gateDrainShare = 0.55;
        backgroundStatus = 'stressed';
      }
    }

    const actualBackgroundDbTraffic = backgroundDbWriteDemand * gateDrainShare;
    const relationalBackgroundWriteShare = hasNoSql ? 0.45 : 1;
    const nosqlBackgroundWriteShare = hasNoSql ? 0.55 : 0;
    distribute(nodeMap, 'relational-db', actualBackgroundDbTraffic * relationalBackgroundWriteShare);
    distribute(nodeMap, 'nosql-db', actualBackgroundDbTraffic * nosqlBackgroundWriteShare);

    newNodes.forEach((node) => {
      const totalCapacity = node.data.instances * node.data.maxCapacityPerInstance;
      const loadRatio = totalCapacity > 0 ? node.data.currentLoad / totalCapacity : 0;
      const isBackgroundStage = BACKGROUND_TIERS.has(node.id);

      if (isBackgroundStage && backgroundStatus === 'overloaded') {
        node.data.status = 'overloaded';
      } else if (isBackgroundStage && backgroundStatus === 'stressed') {
        node.data.status = loadRatio > 1 ? 'overloaded' : 'stressed';
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

    const newEdges: Edge<EdgeData>[] = [];
    const connect = (
      source: string,
      target: string,
      throughput: number,
      kind: EdgeData['kind'],
      route?: EdgeRoute,
    ) => {
      if (!nodeMap.has(source) || !nodeMap.has(target) || throughput <= 0) return;
      newEdges.push({
        id: `e-${source}-${target}-${kind}`,
        source,
        target,
        sourceHandle: route?.sourceHandle,
        targetHandle: route?.targetHandle,
        type: 'custom',
        zIndex: 10,
        data: { throughput, kind },
      });
    };

    // Serving path
    if ((nodeCounts.cdn || 0) > 0) {
      connect('client', 'cdn', totalQps, 'request', { sourceHandle: 'source-right', targetHandle: 'target-left' });
      connect('cdn', 'load-balancer', edgeMisses, 'request', { sourceHandle: 'source-right', targetHandle: 'target-left' });
    } else {
      connect('client', 'load-balancer', totalQps, 'request', { sourceHandle: 'source-right', targetHandle: 'target-left' });
    }
    connect('load-balancer', 'service', edgeMisses, 'request', { sourceHandle: 'source-right', targetHandle: 'target-left' });
    connect('service', 'cache', cacheLookups, 'request', { sourceHandle: 'source-bottom', targetHandle: 'target-left' });
    connect('cache', hasNoSql ? 'nosql-db' : 'relational-db', hasNoSql ? nosqlReadLoad : dbServingReads, 'request', { sourceHandle: 'source-right', targetHandle: 'target-bottom' });
    if (hasNoSql) {
      connect('cache', 'relational-db', relationalReadLoad, 'request', { sourceHandle: 'source-right', targetHandle: 'target-top-left' });
    }
    connect('service', 'relational-db', sumLoads(nonDataApiTraffic, foregroundWriteLoad), 'data', { sourceHandle: 'source-right', targetHandle: 'target-left' });

    // Background pipeline
    connect('message-queue', 'worker', sourceFreshnessPressure, 'data', { sourceHandle: 'source-right', targetHandle: 'target-left' });
    connect('worker', 'object-store', sourceFreshnessPressure, 'data', { sourceHandle: 'source-right', targetHandle: 'target-left' });
    connect('message-queue', 'batch-processor', processorLoad, 'data', { sourceHandle: 'source-right-upper', targetHandle: 'target-left-upper' });
    connect('object-store', 'batch-processor', processorLoad, 'data', { sourceHandle: 'source-right', targetHandle: 'target-left-lower' });
    connect('batch-processor', hasNoSql ? 'nosql-db' : 'relational-db', processorLoad, 'data', { sourceHandle: 'source-top-left', targetHandle: 'target-bottom' });

    // For presets: apply deleted edge overrides, then append any user-added edges
    const filteredEdges = newEdges.filter((e) => !deletedEdgeIds.includes(e.id));
    const userEdgesForPreset = userAddedEdges
      .filter((ue) => nodeMap.has(ue.source) && nodeMap.has(ue.target) && !deletedEdgeIds.includes(ue.id))
      .map((ue) => ({
        id: ue.id,
        source: ue.source,
        target: ue.target,
        sourceHandle: ue.sourceHandle,
        targetHandle: ue.targetHandle,
        type: 'custom' as const,
        zIndex: 10,
        data: { throughput: nodeMap.get(ue.source)?.data.currentLoad ?? 0, kind: ue.kind } as EdgeData,
      }));
    set({ nodes: newNodes, edges: [...filteredEdges, ...userEdgesForPreset], customNodePositions: updatedPositions });
  },
});
});
