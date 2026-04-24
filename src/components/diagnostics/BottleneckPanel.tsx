import { useState } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, AlertCircle, WifiOff } from 'lucide-react';

const getFailureExplanation = (nodeId: string, health: string): string => {
  const base = nodeId.replace(/-\d+$/, '');
  if (health === 'unavailable') {
    switch (base) {
      case 'relational-db': return 'DB offline → service threads block on timed-out queries. Writes fail entirely. Consider read replicas or circuit breakers.';
      case 'nosql-db': return 'NoSQL cluster offline → dependent reads fail. Check partition/replica availability.';
      case 'cache': return 'Cache offline → every read falls through to the database. Expect DB overload.';
      case 'service': return 'Service is fully offline → no requests can be served.';
      case 'load-balancer': return 'Load balancer offline → all ingress traffic is dropped.';
      default: return `${base} is offline and processing no traffic.`;
    }
  }
  // degraded
  switch (base) {
    case 'relational-db': return 'DB degraded (40% capacity) → queries slow down, risk of cascading timeouts.';
    case 'cache': return 'Cache degraded (40% capacity) → increased miss rate, extra DB load.';
    case 'service': return 'Service degraded (40% capacity) → request queue grows, latency spikes.';
    default: return `${base} degraded to 40% capacity.`;
  }
};

export const BottleneckPanel = () => {
  const { nodes } = useSimulatorStore();
  const [isOpen, setIsOpen] = useState(false);

  const offlineNodes = nodes.filter(n => n.data.healthState === 'unavailable' || n.data.healthState === 'degraded');
  const overloadedNodes = nodes.filter(n => n.data.status === 'overloaded' && n.data.healthState !== 'unavailable');
  const stressedNodes = nodes.filter(n => n.data.status === 'stressed');
  const totalWarnings = overloadedNodes.length + stressedNodes.length + offlineNodes.length;

  const getRecommendation = (nodeId: string) => {
    const baseId = nodeId.replace(/-\d+$/, '');
    switch (baseId) {
      case 'cdn': return "Increase edge-cache hit rate so fewer requests reach the core system.";
      case 'load-balancer': return "Add load-balancer capacity or spread traffic across more routing instances.";
      case 'service': return "Scale the stateless service vertically or horizontally.";
      case 'cache': return "Increase serving-cache capacity or improve the hit rate.";
      case 'relational-db': return "Reduce write pressure, add followers, or increase relational-database capacity.";
      case 'nosql-db': return "Increase partitioning or cluster capacity, or reduce high-volume read traffic.";
      case 'blob': return "Reduce durable-input churn or increase durable-store throughput for recovery and derived-state processing.";
      case 'object-store': return "Reduce durable-input churn or increase object-store throughput for recovery and derived-state processing.";
      case 'worker': return "Ingestion pressure is too high; add ingest capacity or reduce upstream change volume.";
      case 'message-queue': return "Queue/broker pressure is too high; add broker capacity, reduce bursts, or cut retry amplification.";
      case 'batch-processor': return "Batch processor is overloaded; scale it up, reduce materialization, backfill, replay intensity, or lower work per task.";
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

  const hasOffline = offlineNodes.length > 0;

  return (
    <div className="w-full flex flex-col pointer-events-auto">
      {/* Dropdown Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between p-3 rounded-xl shadow-lg transition-all duration-300 border backdrop-blur-md ${
          hasOffline || overloadedNodes.length > 0
            ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
        }`}
      >
        <div className="flex items-center space-x-3">
          {hasOffline ? (
            <WifiOff className="shrink-0 animate-pulse" size={20} />
          ) : overloadedNodes.length > 0 ? (
            <AlertCircle className="shrink-0 animate-pulse" size={20} />
          ) : (
            <AlertTriangle className="shrink-0" size={20} />
          )}
          <div className="text-left">
            <p className="text-xs font-black uppercase tracking-widest">
              {hasOffline ? 'Node Failures' : overloadedNodes.length > 0 ? 'Critical Bottlenecks' : 'System Warnings'}
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
          {offlineNodes.map(node => (
            <div key={node.id} className="bg-gray-500/10 dark:bg-gray-950/40 border border-gray-500/20 p-3 rounded-lg backdrop-blur-md">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-black uppercase text-gray-600 dark:text-gray-300">
                  {node.data.label} {node.data.healthState === 'unavailable' ? 'Offline' : 'Degraded'}
                </span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${node.data.healthState === 'unavailable' ? 'bg-gray-500/20 text-gray-700 dark:text-gray-300' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'}`}>
                  {node.data.healthState === 'unavailable' ? '0%' : '40%'}
                </span>
              </div>
              <p className="text-[10px] text-gray-700/80 dark:text-gray-300/70 font-medium italic">
                {getFailureExplanation(node.id, node.data.healthState || 'healthy')}
              </p>
            </div>
          ))}

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
