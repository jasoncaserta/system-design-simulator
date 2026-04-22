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
  EdgeChange,
} from 'reactflow';
import type {
  SimulationStore,
  SimulationParams,
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
  { id: 'cdn', type: 'cdn', label: 'EDGE CACHE', implementationLabel: 'Cloudflare', x: 1, y: 0 },
  { id: 'load-balancer', type: 'load-balancer', label: 'LOAD BALANCER', implementationLabel: 'Nginx', x: 2, y: 0 },
  { id: 'message-queue', type: 'message-queue', label: 'MESSAGE QUEUE', implementationLabel: 'Kafka / RabbitMQ', x: 2, y: 0.9 },
  { id: 'service', type: 'service', label: 'STATELESS SERVICE', implementationLabel: 'FastAPI + Uvicorn', x: 3, y: 0 },
  { id: 'worker', type: 'worker', label: 'INGESTION WORKERS', implementationLabel: "Tom's + Canopy + amzpy + eBay", x: 3, y: 1.24 },
  { id: 'cache', type: 'cache', label: 'SERVING CACHE', implementationLabel: 'Process Memory', x: 4, y: 0.44 },
  { id: 'object-store', type: 'object-store', label: 'OBJECT STORE', implementationLabel: 'Export CSV Repo', x: 4, y: 1.24 },
  { id: 'relational-db', type: 'relational-db', label: 'RELATIONAL DB', implementationLabel: 'PostgreSQL / MySQL', x: 5, y: 0 },
  { id: 'nosql-db', type: 'nosql-db', label: 'NOSQL DB', implementationLabel: 'Cassandra / MongoDB', x: 6, y: 0.08 },
  { id: 'batch-processor', type: 'batch-processor', label: 'BATCH PROCESSOR', implementationLabel: 'Rescore + Replay + Backfill', x: 7, y: 0.95 },
];

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

const PICKGPU_NODE_COUNTS = {
  client: 1,
  cdn: 1,
  'load-balancer': 1,
  service: 1,
  cache: 1,
  'relational-db': 1,
  'nosql-db': 1,
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
    nosqlPartitionCount: 6,
    databaseWriteLoad: 0.35,
    relationalReplicationMode: 'leader_follower' as const,
    objectStoreThroughput: 0.65,
    objectStoreScanCost: 0.25,
    maxBackgroundConcurrency: 2,
    enableApiPriorityGate: true,
  };
};

export const useSimulatorStore = create<SimulationStore>((set, get) => ({
  ...INITIAL_PARAMS,
  nodeCounts: { ...INITIAL_COUNTS },
  nodeCapacities: { ...INITIAL_CAPACITIES },
  nodes: [],
  edges: [],
  currentSystem: 'starter',
  expandedNodeId: null,
  showNodeConfig: true,
  implementationLabels: {},

  updateImplementationLabel: (nodeId, label) => {
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
    set({ ...params, currentSystem: 'custom' });
    get().runSimulation();
  },

  updateNodeInstances: (tierId, instances) => {
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
      currentSystem: 'custom',
    }));
    get().runSimulation();
  },

  loadStarterSystem: () => {
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
      implementationLabels: {},
    });
    get().runSimulation();
  },

  loadPickGPUSystem: () => {
    const pickGPUDefaults = buildPickGPUDefaults();
    set({
      ...pickGPUDefaults,
      currentSystem: 'pickgpu',
      expandedNodeId: null,
      implementationLabels: {},
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
      implementationLabels,
    } = get();

    const totalQps = users * rpsPerUser;
    const activeLayers = LAYERS.filter((layer) => (nodeCounts[layer.id] || 0) > 0);

    const COL_WIDTH = 340;
    const ROW_HEIGHT = 500;

    const usedCols = Array.from(new Set(activeLayers.map((l) => l.x))).sort((a, b) => a - b);
    const colMap = new Map(usedCols.map((col, i) => [col, i * COL_WIDTH]));

    const newNodes: Node<NodeData>[] = [];

    activeLayers.forEach((layer) => {
      const count = nodeCounts[layer.id] ?? 0;

      newNodes.push({
        id: layer.id,
        type: 'custom',
        position: { x: colMap.get(layer.x)!, y: layer.y * ROW_HEIGHT },
        data: {
          type: layer.type as NodeType,
          label: layer.label,
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

    set({ nodes: newNodes, edges: newEdges });
  },
}));
