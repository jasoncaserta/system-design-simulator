import { useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { CustomNode } from './CustomNodes';
import { CustomEdge } from './CustomEdges';

const nodeTypes = {
  custom: CustomNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

export const SystemCanvas = () => {
  const { 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange, 
    onConnect,
    runSimulation,
    loadStarterSystem
  } = useSimulatorStore();

  // Initial simulation run
  useEffect(() => {
    runSimulation();
  }, []);

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
        <Panel position="top-right" className="bg-white dark:bg-gray-800 p-2 rounded shadow-md border border-gray-200 dark:border-gray-700">
          <button 
            onClick={loadStarterSystem}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
          >
            Reset to Starter System
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
};
