import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Panel,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow
} from 'reactflow';
import {
  Archive, ChevronDown, ChevronUp, Cog, Cpu, Database, DatabaseZap,
  Gauge, Globe, MonitorSmartphone, Plus, Redo2, Router, ServerCog, Settings, Share2, Undo2, Waypoints, X,
} from 'lucide-react';
import 'reactflow/dist/style.css';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { CustomNode } from './CustomNodes';
import { CustomEdge } from './CustomEdges';
import { cn } from '../../utils/cn';
import { getServingMagnitude } from '../../utils/servingMagnitude';
import { decodeConfig, encodeConfig } from '../../utils/shareCfg';
import type { SharedConfig, NodeType } from '../../store/types';
import { useShareUrl } from '../../hooks/useShareUrl';
import { NewSystemModal } from './NewSystemModal';
import type { Connection } from 'reactflow';

const nodeTypes = {
  custom: CustomNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const FIT_VIEW_OPTIONS = {
  padding: 0.2,
  duration: 800,
};

const CONNECTION_RADIUS = 28;

const NODE_PICKER_SECTIONS: { label: string; items: { type: NodeType; label: string; icon: React.ElementType; color: string }[] }[] = [
  {
    label: 'Ingress',
    items: [
      { type: 'client', label: 'Clients', icon: MonitorSmartphone, color: 'bg-sky-500' },
      { type: 'cdn', label: 'Edge Cache', icon: Globe, color: 'bg-sky-500' },
      { type: 'load-balancer', label: 'Load Balancer', icon: Router, color: 'bg-sky-500' },
    ],
  },
  {
    label: 'Serving',
    items: [
      { type: 'service', label: 'Service', icon: ServerCog, color: 'bg-violet-500' },
      { type: 'cache', label: 'Cache', icon: Gauge, color: 'bg-violet-500' },
    ],
  },
  {
    label: 'Data',
    items: [
      { type: 'relational-db', label: 'Relational DB', icon: Database, color: 'bg-amber-500' },
      { type: 'nosql-db', label: 'NoSQL DB', icon: DatabaseZap, color: 'bg-amber-500' },
    ],
  },
  {
    label: 'Background',
    items: [
      { type: 'message-queue', label: 'Message Queue', icon: Waypoints, color: 'bg-emerald-500' },
      { type: 'worker', label: 'Workers', icon: Cog, color: 'bg-emerald-500' },
      { type: 'object-store', label: 'Object Store', icon: Archive, color: 'bg-emerald-500' },
      { type: 'batch-processor', label: 'Batch Processor', icon: Cpu, color: 'bg-emerald-500' },
    ],
  },
];

type UrlInit =
  | { kind: 'preset'; system: 'starter' | 'pickgpu' }
  | { kind: 'cfg'; encoded: string }
  | { kind: 'default' };

const getSystemFromUrl = (): UrlInit => {
  const params = new URLSearchParams(window.location.search);
  const cfg = params.get('cfg');
  if (cfg) return { kind: 'cfg', encoded: cfg };
  const system = params.get('system');
  if (system === 'pickgpu') return { kind: 'preset', system: 'pickgpu' };
  if (system === 'starter') return { kind: 'preset', system: 'starter' };
  return { kind: 'default' };
};

export const SystemCanvasInner = () => {
  const store = useSimulatorStore();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    addUserEdge,
    addNode,
    loadStarterSystem,
    loadPickGPUSystem,
    loadCustomSystem,
    hydrateFromConfig,
    refreshAutoLayout,
    undo,
    redo,
    past,
    future,
    currentSystem,
    nodeCounts,
    users,
    rpsPerUser,
    showNodeConfig,
    toggleNodeConfig,
  } = store;

  const buildUrlConfig = useCallback((): SharedConfig => {
    const s = useSimulatorStore.getState();
    return {
      v: 1,
      params: {
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
      },
      nodeCounts: s.nodeCounts,
      nodeCapacities: s.nodeCapacities,
      nodeLabels: s.nodeLabels,
      implementationLabels: s.implementationLabels,
      currentSystem: s.currentSystem,
      enabledLayers: s.enabledLayers,
      deletedEdgeIds: s.deletedEdgeIds,
      userAddedEdges: s.userAddedEdges,
      customNodePositions: s.customNodePositions,
    };
  }, []);

  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const [isLegendMinimized, setIsLegendMinimized] = useState(true);
  const [showNewSystemModal, setShowNewSystemModal] = useState(false);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const hasHydratedFromUrl = useRef(false);
  const urlSyncSkipsLeft = useRef(2);
  const urlSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectEndPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const measuredLayoutKeyRef = useRef<string | null>(null);
  const { share, copied } = useShareUrl();

  useEffect(() => {
    if (hasHydratedFromUrl.current) return;
    hasHydratedFromUrl.current = true;

    const init = getSystemFromUrl();
    if (init.kind === 'cfg') {
      const cfg = decodeConfig(init.encoded);
      if (cfg) {
        hydrateFromConfig(cfg);
        return;
      }
    } else if (init.kind === 'preset' && init.system === 'pickgpu') {
      loadPickGPUSystem();
      return;
    }

    loadStarterSystem();
  }, [loadPickGPUSystem, loadStarterSystem, hydrateFromConfig]);

  // Real-time URL sync: debounce 400ms after any state change (nodes update on every runSimulation)
  useEffect(() => {
    if (urlSyncSkipsLeft.current > 0) {
      urlSyncSkipsLeft.current -= 1;
      return;
    }
    if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    urlSyncTimer.current = setTimeout(() => {
      const cfg = buildUrlConfig();
      const encoded = encodeConfig(cfg);
      const url = new URL(window.location.href);
      url.searchParams.delete('system');
      url.searchParams.set('cfg', encoded);
      window.history.replaceState({}, '', url.toString());
    }, 400);
    return () => {
      if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    };
  }, [nodes, buildUrlConfig]);

  useEffect(() => {
    if (!nodesInitialized || nodes.length === 0) return;
    fitView(FIT_VIEW_OPTIONS);
  }, [nodesInitialized, nodes.length, fitView]);

  useEffect(() => {
    if (!nodesInitialized || nodes.length === 0) return;
    if (currentSystem === 'custom') return;

    const measuredNodes = nodes.filter((node) => node.width != null && node.height != null);
    if (measuredNodes.length !== nodes.length) return;

    const measurementKey = measuredNodes
      .map((node) => `${node.id}:${Math.round(node.width ?? 0)}x${Math.round(node.height ?? 0)}`)
      .join('|');
    const layoutKey = `${currentSystem}:${showNodeConfig}:${measurementKey}`;
    if (measuredLayoutKeyRef.current === layoutKey) return;
    measuredLayoutKeyRef.current = layoutKey;

    const timer = setTimeout(() => refreshAutoLayout(), 120);
    return () => clearTimeout(timer);
  }, [nodesInitialized, nodes, currentSystem, showNodeConfig, refreshAutoLayout]);

  useEffect(() => {
    // Re-center after system switch once nodes have settled
    const timer = setTimeout(() => fitView(FIT_VIEW_OPTIONS), 50);
    return () => clearTimeout(timer);
  }, [currentSystem, fitView]);

  useEffect(() => {
    if (nodes.length === 0) return;
    if (currentSystem === 'custom') return;
    const timer = setTimeout(() => refreshAutoLayout(), 140);
    return () => clearTimeout(timer);
  }, [showNodeConfig, nodes.length, refreshAutoLayout]);

  // Keyboard shortcuts: Cmd/Ctrl+Z → undo, Cmd/Ctrl+Shift+Z → redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const handleReset = () => {
    loadStarterSystem();
  };

  const handlePickGPU = () => {
    loadPickGPUSystem();
  };

  // Capture mouse position at drag end so the type popover can be placed there
  const handleConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const src = 'clientX' in event ? event : (event as TouchEvent).changedTouches[0];
    if (src) connectEndPosRef.current = { x: (src as MouseEvent).clientX, y: (src as MouseEvent).clientY };
  }, []);

  // Instead of committing immediately, store pending connection and show type selector
  const handleConnect = useCallback((connection: Connection) => {
    setPendingConnection(connection);
    setPendingPos({ ...connectEndPosRef.current });
  }, []);

  const commitConnection = useCallback((kind: 'request' | 'data') => {
    if (!pendingConnection) return;
    addUserEdge(pendingConnection, kind);
    setPendingConnection(null);
    setPendingPos(null);
  }, [pendingConnection, addUserEdge]);

  const cancelConnection = useCallback(() => {
    setPendingConnection(null);
    setPendingPos(null);
  }, []);

  const handleAddNode = useCallback((type: NodeType) => {
    addNode(type);
  }, [addNode]);

  return (
    <>
    {showNewSystemModal && (
      <NewSystemModal
        onClose={() => setShowNewSystemModal(false)}
        onCreate={(layers, autoConnect) => loadCustomSystem(layers, autoConnect)}
      />
    )}

    {/* Connection type selector */}
    {pendingConnection && pendingPos && (
      <div
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 pointer-events-auto"
        style={{ left: pendingPos.x - 8, top: pendingPos.y - 8, transform: 'translate(-50%, -100%) translateY(-8px)' }}
      >
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500 mb-2">
          Connection Type
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => commitConnection('request')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold uppercase tracking-wide cursor-pointer transition-colors"
          >
            Request Path
          </button>
          <button
            onClick={() => commitConnection('data')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-bold uppercase tracking-wide cursor-pointer transition-colors"
          >
            Data Pipeline
          </button>
          <button
            onClick={cancelConnection}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 cursor-pointer"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    )}

    <div className="w-full h-full bg-slate-50 dark:bg-slate-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectEnd={handleConnectEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionRadius={CONNECTION_RADIUS}
        defaultEdgeOptions={{ zIndex: 10 }}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
      >
        <Background />
        <Controls fitViewOptions={FIT_VIEW_OPTIONS} />
        <Panel position="top-left" className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 pointer-events-auto w-64">
          <h1 className="text-sm font-black text-gray-900 dark:text-gray-100 tracking-tight flex items-center">
            <span className="bg-blue-600 text-white p-1 rounded mr-2 h-5 w-5 flex items-center justify-center text-[10px] font-mono italic">S</span>
            System Design Simulator
          </h1>
          <div className="mt-2 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30 rounded px-2 py-1.5">
            <p className="text-[9px] uppercase font-black tracking-widest text-blue-500/80 dark:text-blue-400/80">
              Serving Magnitude
            </p>
            <p className="text-[11px] font-bold text-slate-700 dark:text-blue-200">
              {getServingMagnitude(users * rpsPerUser)}
            </p>
          </div>
          <button
            onClick={toggleNodeConfig}
            className="w-full mt-2 py-1.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-colors bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-1.5"
          >
            <Settings size={12} />
            {showNodeConfig ? 'Hide' : 'Show'} Node Configuration
          </button>
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={undo}
              disabled={past.length === 0}
              title="Undo (⌘Z)"
              className="flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Undo2 size={11} /> Undo
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              title="Redo (⌘⇧Z)"
              className="flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Redo2 size={11} /> Redo
            </button>
          </div>
        </Panel>
        <Panel position="top-right" className="bg-white dark:bg-gray-800 p-2 rounded shadow-md border border-gray-200 dark:border-gray-700 pointer-events-auto flex flex-col space-y-2 w-52">
          <button
            onClick={handleReset}
            className={cn(
              "px-3 py-2 text-white text-xs rounded transition-colors font-bold uppercase tracking-tight w-full cursor-pointer",
              currentSystem === 'starter' ? "bg-blue-600 hover:bg-blue-700 shadow-inner" : "bg-gray-400 hover:bg-gray-500 opacity-80"
            )}
          >
            {currentSystem === 'starter' ? '✓ Starter System' : 'Starter System'}
          </button>
          <button
            onClick={handlePickGPU}
            className={cn(
              "px-3 py-2 text-white text-xs rounded transition-colors font-bold uppercase tracking-tight w-full cursor-pointer",
              currentSystem === 'pickgpu' ? "bg-blue-600 hover:bg-blue-700 shadow-inner" : "bg-gray-400 hover:bg-gray-500 opacity-80"
            )}
          >
            {currentSystem === 'pickgpu' ? '✓ pickGPU System' : 'pickGPU System'}
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex flex-col space-y-2">
            <button
              onClick={() => setShowNewSystemModal(true)}
              className="px-3 py-2 text-xs rounded transition-colors font-bold uppercase tracking-tight w-full cursor-pointer flex items-center justify-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              New System
            </button>
            <div className="relative">
                <button
                  onClick={() => setShowNodePicker((v) => !v)}
                  className="px-3 py-2 text-xs rounded transition-colors font-bold uppercase tracking-tight w-full cursor-pointer flex items-center justify-center gap-1.5 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <Plus size={12} />
                  Add Node
                </button>
                {showNodePicker && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    {NODE_PICKER_SECTIONS.map((section, si) => (
                      <div key={section.label}>
                        {si > 0 && <div className="h-px bg-gray-100 dark:bg-gray-700" />}
                        <div className="px-3 pt-2 pb-0.5 text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">{section.label}</div>
                        {section.items.map((opt) => {
                          const Icon = opt.icon;
                          const isPresent = (nodeCounts[opt.type as string] ?? 0) > 0;
                          return (
                            <button
                              key={opt.type}
                              onClick={() => handleAddNode(opt.type)}
                              className={cn(
                                'w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer transition-colors text-[11px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700',
                              )}
                            >
                              <span className={cn('p-1 rounded text-white shrink-0', opt.color)}>
                                <Icon size={10} />
                              </span>
                              {opt.label}
                              {isPresent && <span className="ml-auto text-[9px] uppercase tracking-wide text-emerald-500 dark:text-emerald-400">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                    <div className="h-px bg-gray-100 dark:bg-gray-700" />
                    <button
                      onClick={() => setShowNodePicker(false)}
                      className="w-full px-3 py-2 text-[11px] text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-center"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            <button
              onClick={share}
              className={cn(
                "px-3 py-2 text-xs rounded transition-colors font-bold uppercase tracking-tight w-full cursor-pointer flex items-center justify-center gap-1.5",
                copied
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              )}
            >
              <Share2 size={12} />
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </Panel>
        <Panel position="bottom-right" className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded shadow-md border border-gray-200 dark:border-gray-700 pointer-events-auto w-64">
          <button
            onClick={() => setIsLegendMinimized((current) => !current)}
            className="w-full flex items-center justify-between text-left cursor-pointer"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Legend
            </p>
            {isLegendMinimized ? (
              <ChevronUp size={14} className="text-slate-500 dark:text-slate-400" />
            ) : (
              <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
            )}
          </button>
          {!isLegendMinimized && (
            <div className="space-y-3 mt-3">
              <div className="flex items-start space-x-3">
                <div className="relative mt-1 h-2 w-12 shrink-0">
                  <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-blue-500/70" />
                  <div className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-sky-400" />
                  <div className="absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-sky-400/70" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                    Request Path
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Small cyan dots
                  </div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="relative mt-1 h-3 w-12 shrink-0">
                  <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-amber-500/70" />
                  <div className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-amber-300" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                    Data Pipeline
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Large amber dots
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                  Node Categories
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-sky-500" />
                    <span>Ingress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-violet-500" />
                    <span>Serving</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-amber-500" />
                    <span>Data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span>Background</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                  Layout Convention
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <div>Left → Right = request flow depth</div>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </ReactFlow>
    </div>
    </>
  );
};

export const SystemCanvas = () => (
  <ReactFlowProvider>
    <SystemCanvasInner />
  </ReactFlowProvider>
);
