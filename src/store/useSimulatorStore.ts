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
} from './types';

const CORE_TIERS = new Set(['client', 'lb', 'app', 'cache', 'db']);

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
  sourceJobTypes: 0,
  refreshCadence: 'rare',
  averageJobCost: 'medium',
  derivedStateCadence: 'rare',
  backfillMode: 'off',
  recoveryMode: 'off',
  maxBackgroundConcurrency: 1,
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
  recompute: 0,
  bootstrap: 0,
  history: 0,
};

const INITIAL_CAPACITIES = {
  client: 1000000,
  lb: 5000,
  app: 250,
  cache: 25000,
  db: 500,
  cdn: 100000,
  queue: 400,
  worker: 80,
  'blob-storage': 1500,
  recompute: 120,
  bootstrap: 180,
  history: 80,
};

const LAYERS: LayerDef[] = [
  { id: 'client', type: 'client', label: 'CLIENTS', implementationLabel: 'Browsers', x: 0, y: 0 },
  { id: 'cdn', type: 'cdn', label: 'EDGE CACHE', implementationLabel: 'Cloudflare', x: 1, y: 0 },
  { id: 'lb', type: 'lb', label: 'REQUEST ROUTER', implementationLabel: 'Nginx', x: 2, y: 0 },
  { id: 'queue', type: 'queue', label: 'JOB SCHEDULER', implementationLabel: 'APScheduler', x: 2, y: 1 },
  { id: 'app', type: 'app', label: 'STATELESS SERVICE', implementationLabel: 'FastAPI + Uvicorn', x: 3, y: 0 },
  { id: 'worker', type: 'worker', label: 'INGESTION WORKERS', implementationLabel: "Tom's + Canopy + amzpy + eBay", x: 3, y: 1 },
  { id: 'cache', type: 'cache', label: 'SERVING CACHE', implementationLabel: 'Process Memory', x: 4, y: 0.35 },
  { id: 'blob-storage', type: 'blob-storage', label: 'DURABLE STORE', implementationLabel: 'Export CSV Repo', x: 4, y: 1 },
  { id: 'db', type: 'db', label: 'SERVING DATABASE', implementationLabel: 'SQLite', x: 5, y: 0 },
  { id: 'recompute', type: 'recompute', label: 'DERIVED STATE PIPELINE', implementationLabel: 'Rescore Current Listings', x: 5, y: 1 },
  { id: 'bootstrap', type: 'bootstrap', label: 'RECOVERY PIPELINE', implementationLabel: 'Startup Replay', x: 6, y: 0 },
  { id: 'history', type: 'history', label: 'BACKFILL PIPELINE', implementationLabel: 'listing_history Backfill', x: 6, y: 1 },
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
  lb: 1,
  app: 1,
  cache: 1,
  db: 1,
  queue: 1,
  worker: 1,
  'blob-storage': 1,
  recompute: 1,
  bootstrap: 1,
  history: 1,
} as const;

const PICKGPU_NODE_CAPACITIES = {
  client: 1000000,
  cdn: 100000,
  lb: 5000,
  app: 200,
  cache: 5000,
  db: 120,
  queue: 40,
  worker: 25,
  'blob-storage': 1200,
  recompute: 80,
  bootstrap: 120,
  history: 50,
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

const deriveBackgroundLoads = ({
  sourceJobTypes,
  refreshCadence,
  averageJobCost,
  derivedStateCadence,
  backfillMode,
  recoveryMode,
  maxBackgroundConcurrency,
}: Pick<
  SimulationParams,
  | 'sourceJobTypes'
  | 'refreshCadence'
  | 'averageJobCost'
  | 'derivedStateCadence'
  | 'backfillMode'
  | 'recoveryMode'
  | 'maxBackgroundConcurrency'
>) => {
  const cadence = CADENCE_CONFIG[refreshCadence];
  const derivedCadence = CADENCE_CONFIG[derivedStateCadence];
  const jobCost = JOB_COST_CONFIG[averageJobCost];
  const backfill = BACKFILL_MODE_CONFIG[backfillMode];
  const recovery = RECOVERY_MODE_CONFIG[recoveryMode];
  const concurrencyFactor = clamp(0.75 + maxBackgroundConcurrency * 0.15, 0.75, 1.8);

  const sourceFreshnessPressure = sourceJobTypes * cadence.sourceRate * jobCost.worker * concurrencyFactor;
  const recomputePressure = Math.max(
    sourceJobTypes * 0.6,
    sourceJobTypes * derivedCadence.derivedRate * jobCost.derived * 1.5 * concurrencyFactor,
  );
  const historicalRebuildPressure = backfill.pressure * jobCost.history * clamp(0.7 + maxBackgroundConcurrency * 0.08, 0.7, 1.3);
  const bootstrapReplayLoad = recovery.pressure * jobCost.recovery;

  const schedulerCoordinationLoad = sumLoads(
    sourceJobTypes * cadence.schedulerRate * jobCost.scheduler,
    Math.max(1, sourceJobTypes * 0.4) * derivedCadence.schedulerRate,
    backfill.schedulerRate,
    recovery.schedulerRate,
  ) * concurrencyFactor;

  return {
    sourceFreshnessPressure,
    recomputePressure,
    historicalRebuildPressure,
    bootstrapReplayLoad,
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
    averageJobCost: 'medium' as const,
    derivedStateCadence: 'periodic' as const,
    backfillMode: 'off' as const,
    recoveryMode: 'off' as const,
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
        lb: 1,
        app: 1,
        cache: 1,
        db: 1,
        cdn: 0,
        queue: 0,
        worker: 0,
        'blob-storage': 0,
        recompute: 0,
        bootstrap: 0,
        history: 0,
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
      sourceJobTypes,
      refreshCadence,
      averageJobCost,
      derivedStateCadence,
      backfillMode,
      recoveryMode,
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
          maxCapacityPerInstance: nodeCapacities[layer.id],
          currentLoad: 0,
          status: 'healthy',
        },
      });
    });

    const nodeMap = new Map(newNodes.map((node) => [node.id, node]));

    const edgeMisses = totalQps * (1 - cdnHitRate);
    const servingReads = edgeMisses * readWriteRatio;
    const nonDataApiTraffic = edgeMisses - servingReads;
    const cacheLookups = servingReads;
    const dbServingReads = servingReads * (1 - cacheHitRate);

    const {
      sourceFreshnessPressure,
      recomputePressure,
      historicalRebuildPressure,
      bootstrapReplayLoad,
      schedulerCoordinationLoad,
    } = deriveBackgroundLoads({
      sourceJobTypes,
      refreshCadence,
      averageJobCost,
      derivedStateCadence,
      backfillMode,
      recoveryMode,
      maxBackgroundConcurrency,
    });

    const snapshotStoreLoad = sumLoads(
      sourceFreshnessPressure,
      recomputePressure,
      historicalRebuildPressure,
      bootstrapReplayLoad,
    );
    const bootstrapWriteDemand = bootstrapReplayLoad;
    const recomputeWriteDemand = recomputePressure * 0.9;
    const historyWriteDemand = historicalRebuildPressure * 0.75;
    const backgroundDbWriteDemand = sumLoads(
      bootstrapWriteDemand,
      recomputeWriteDemand,
      historyWriteDemand,
    );

    distribute(nodeMap, 'client', totalQps);
    distribute(nodeMap, 'cdn', totalQps);
    distribute(nodeMap, 'lb', edgeMisses);
    distribute(nodeMap, 'app', edgeMisses);
    distribute(nodeMap, 'cache', cacheLookups);
    distribute(nodeMap, 'db', dbServingReads + nonDataApiTraffic);
    distribute(nodeMap, 'queue', schedulerCoordinationLoad);
    distribute(nodeMap, 'worker', sourceFreshnessPressure);
    distribute(nodeMap, 'blob-storage', snapshotStoreLoad);
    distribute(nodeMap, 'recompute', recomputePressure);
    distribute(nodeMap, 'bootstrap', bootstrapReplayLoad);
    distribute(nodeMap, 'history', historicalRebuildPressure);

    const rawAppCapacity = nodeCounts.app * nodeCapacities.app;
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

    const actualBootstrapWrites = bootstrapWriteDemand * gateDrainShare;
    const actualRecomputeWrites = recomputeWriteDemand * gateDrainShare;
    const actualHistoryWrites = historyWriteDemand * gateDrainShare;
    const actualBackgroundDbTraffic = backgroundDbWriteDemand * gateDrainShare;

    distribute(nodeMap, 'db', actualBackgroundDbTraffic);

    newNodes.forEach((node) => {
      const totalCapacity = node.data.instances * node.data.maxCapacityPerInstance;
      const loadRatio = totalCapacity > 0 ? node.data.currentLoad / totalCapacity : 0;
      const isBackgroundStage = (
        node.id.startsWith('queue') ||
        node.id.startsWith('worker') ||
        node.id.startsWith('blob-storage') ||
        node.id.startsWith('recompute') ||
        node.id.startsWith('bootstrap') ||
        node.id.startsWith('history')
      );

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

    if ((nodeCounts.cdn || 0) > 0) {
      connect('client', 'cdn', totalQps, 'request', { sourceHandle: 'source-right', targetHandle: 'target-left' });
      connect('cdn', 'lb', edgeMisses, 'request', { sourceHandle: 'source-right', targetHandle: 'target-left' });
    } else {
      connect('client', 'lb', totalQps, 'request', { sourceHandle: 'source-right', targetHandle: 'target-left' });
    }
    connect('lb', 'app', edgeMisses, 'request', { sourceHandle: 'source-right', targetHandle: 'target-left' });
    connect('app', 'cache', cacheLookups, 'request', { sourceHandle: 'source-bottom', targetHandle: 'target-left' });
    connect('cache', 'db', dbServingReads, 'request', { sourceHandle: 'source-right', targetHandle: 'target-bottom' });
    connect('app', 'db', nonDataApiTraffic, 'data', { sourceHandle: 'source-right', targetHandle: 'target-left' });

    connect('queue', 'worker', sourceFreshnessPressure, 'data', { sourceHandle: 'source-right', targetHandle: 'target-left' });
    connect('worker', 'blob-storage', sourceFreshnessPressure, 'data', { sourceHandle: 'source-right', targetHandle: 'target-left' });
    connect('queue', 'recompute', recomputePressure, 'data', { sourceHandle: 'source-top', targetHandle: 'target-derived-left-upper' });
    connect('blob-storage', 'recompute', recomputePressure, 'data', { sourceHandle: 'source-right', targetHandle: 'target-derived-left-lower' });
    connect('blob-storage', 'bootstrap', bootstrapReplayLoad, 'data', { sourceHandle: 'source-top', targetHandle: 'target-bottom' });
    connect('blob-storage', 'history', historicalRebuildPressure, 'data', { sourceHandle: 'source-bottom', targetHandle: 'target-left' });
    connect('history', 'db', actualHistoryWrites, 'data', { sourceHandle: 'source-top', targetHandle: 'target-bottom' });
    connect('recompute', 'db', actualRecomputeWrites, 'data', { sourceHandle: 'source-derived-right-upper', targetHandle: 'target-bottom' });
    connect('bootstrap', 'db', actualBootstrapWrites, 'data', { sourceHandle: 'source-left', targetHandle: 'target-right' });

    set({ nodes: newNodes, edges: newEdges });
  },
}));
