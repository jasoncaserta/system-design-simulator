import { useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { CustomNode } from './CustomNodes';
import { CustomEdge } from './CustomEdges';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nodeTypes = {
  custom: CustomNode,
};

const edgeTypes = {
  custom: CustomEdge,
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
    currentSystem
  } = useSimulatorStore();

  const { fitView } = useReactFlow();

  // Initial simulation run
  useEffect(() => {
    runSimulation();
  }, []);

  const handleReset = () => {
    loadStarterSystem();
    // Delay slightly to allow nodes to update before fitting view
    setTimeout(() => {
      fitView({ duration: 800, padding: 0.2 });
    }, 50);
  };

  const handlePickGPU = () => {
    loadPickGPUSystem();
    setTimeout(() => {
      fitView({ duration: 800, padding: 0.2 });
    }, 50);
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
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
        <Panel position="top-right" className="bg-white dark:bg-gray-800 p-2 rounded shadow-md border border-gray-200 dark:border-gray-700 pointer-events-auto flex flex-col space-y-2 w-52">
          <button
            onClick={handleReset}
            className={cn(
              "px-3 py-2 text-white text-xs rounded transition-colors font-bold uppercase tracking-tight w-full",
              currentSystem === 'starter' ? "bg-blue-600 hover:bg-blue-700 shadow-inner" : "bg-gray-400 hover:bg-gray-500 opacity-80"
            )}
          >
            {currentSystem === 'starter' ? '✓ Starter System' : 'Starter System'}
          </button>
          <button
            onClick={handlePickGPU}
            className={cn(
              "px-3 py-2 text-white text-xs rounded transition-colors font-bold uppercase tracking-tight w-full",
              currentSystem === 'pickgpu' ? "bg-blue-600 hover:bg-blue-700 shadow-inner" : "bg-gray-400 hover:bg-gray-500 opacity-80"
            )}
          >
            {currentSystem === 'pickgpu' ? '✓ pickGPU System' : 'pickGPU System'}
          </button>
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
