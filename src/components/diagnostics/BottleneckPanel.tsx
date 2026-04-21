import { useState } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

export const BottleneckPanel = () => {
  const { nodes } = useSimulatorStore();
  const [isOpen, setIsOpen] = useState(false);

  const overloadedNodes = nodes.filter(n => n.data.status === 'overloaded');
  const stressedNodes = nodes.filter(n => n.data.status === 'stressed');
  const totalWarnings = overloadedNodes.length + stressedNodes.length;

  const getRecommendation = (nodeId: string) => {
    const baseId = nodeId.split('-')[0];
    switch (baseId) {
      case 'cdn': return "Increase CDN hit rate by caching more assets at the edge.";
      case 'lb': return "Increase Load Balancer capacity or add more instances.";
      case 'app': return "Add more App Server instances or increase CPU/RAM.";
      case 'cache': return "Increase cache size or improve hit rate.";
      case 'db': return "Add DB replicas, shard, or scale vertically (SQLite limited to single-writer).";
      case 'blob-storage': return "Increase storage throughput or optimize file access.";
      case 'worker': return "Check if background jobs are being throttled by the API Priority Gate.";
      default: return "Review capacity and scale accordingly.";
    }
  };

  if (totalWarnings === 0) {
    return (
      <div className="bg-green-500/10 dark:bg-green-900/20 backdrop-blur-md border border-green-500/20 rounded-xl p-3 shadow-lg flex items-center space-x-3 w-fit">
        <CheckCircle className="text-green-500 shrink-0" size={18} />
        <span className="text-xs font-black text-green-700 dark:text-green-400 uppercase tracking-wider">System Healthy</span>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col pointer-events-auto">
      {/* Dropdown Header */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between p-3 rounded-xl shadow-lg transition-all duration-300 border backdrop-blur-md ${
          overloadedNodes.length > 0 
            ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400' 
            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
        }`}
      >
        <div className="flex items-center space-x-3">
          {overloadedNodes.length > 0 ? (
            <AlertCircle className="shrink-0 animate-pulse" size={20} />
          ) : (
            <AlertTriangle className="shrink-0" size={20} />
          )}
          <div className="text-left">
            <p className="text-xs font-black uppercase tracking-widest">
              {overloadedNodes.length > 0 ? 'Critical Bottlenecks' : 'System Warnings'}
            </p>
            <p className="text-[10px] font-bold opacity-80 uppercase">
              {totalWarnings} {totalWarnings === 1 ? 'Node' : 'Nodes'} requiring attention
            </p>
          </div>
        </div>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div className="mt-2 space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {overloadedNodes.map(node => (
            <div key={node.id} className="bg-red-500/10 dark:bg-red-950/40 border border-red-500/20 p-3 rounded-lg backdrop-blur-md">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-black uppercase text-red-700 dark:text-red-400">{node.data.label} Overloaded</span>
                <span className="text-[10px] font-mono font-bold bg-red-500/20 px-1.5 py-0.5 rounded text-red-800 dark:text-red-300">
                  {((node.data.currentLoad / (node.data.instances * node.data.maxCapacityPerInstance)) * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-[10px] text-red-900/80 dark:text-red-200/60 font-medium italic">
                {getRecommendation(node.id)}
              </p>
            </div>
          ))}

          {stressedNodes.map(node => (
            <div key={node.id} className="bg-yellow-500/10 dark:bg-yellow-950/40 border border-yellow-500/20 p-3 rounded-lg backdrop-blur-md">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-black uppercase text-yellow-700 dark:text-yellow-400">{node.data.label} Stressed</span>
                <span className="text-[10px] font-mono font-bold bg-yellow-500/20 px-1.5 py-0.5 rounded text-yellow-800 dark:text-yellow-300">
                  {((node.data.currentLoad / (node.data.instances * node.data.maxCapacityPerInstance)) * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-[10px] text-yellow-900/80 dark:text-yellow-200/60 font-medium italic">
                {getRecommendation(node.id)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
