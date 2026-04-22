import { useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Panel,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow
} from 'reactflow';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';
import 'reactflow/dist/style.css';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { CustomNode } from './CustomNodes';
import { CustomEdge } from './CustomEdges';
import { cn } from '../../utils/cn';
import { getServingMagnitude } from '../../utils/servingMagnitude';

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

export const SystemCanvasInner = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    runSimulation,
    loadStarterSystem,
    loadPickGPUSystem,
    currentSystem,
    users,
    rpsPerUser,
    showNodeConfig,
    toggleNodeConfig,
  } = useSimulatorStore();

  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const [isLegendMinimized, setIsLegendMinimized] = useState(false);

  // Initial simulation run
  useEffect(() => {
    runSimulation();
  }, [runSimulation]);

  useEffect(() => {
    if (!nodesInitialized || nodes.length === 0) return;
    fitView(FIT_VIEW_OPTIONS);
  }, [nodesInitialized, nodes.length, fitView]);

  useEffect(() => {
    // Re-center after system switch once nodes have settled
    const timer = setTimeout(() => fitView(FIT_VIEW_OPTIONS), 50);
    return () => clearTimeout(timer);
  }, [currentSystem, fitView]);

  const handleReset = () => {
    loadStarterSystem();
  };

  const handlePickGPU = () => {
    loadPickGPUSystem();
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
        </Panel>
        <Panel position="bottom-right" className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded shadow-md border border-gray-200 dark:border-gray-700 pointer-events-auto w-64">
          <button
            onClick={() => setIsLegendMinimized((current) => !current)}
            className="w-full flex items-center justify-between text-left cursor-pointer"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Connection Key
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
                  <div className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-blue-400" />
                  <div className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-blue-300/80" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                    Request Path
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Bidirectional request / response traffic
                  </div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="relative mt-1 h-2 w-12 shrink-0">
                  <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-amber-500/70" />
                  <div className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-amber-400" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                    Data Pipeline
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    One-way lifecycle / rebuild movement
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
  );
};

export const SystemCanvas = () => (
  <ReactFlowProvider>
    <SystemCanvasInner />
  </ReactFlowProvider>
);
