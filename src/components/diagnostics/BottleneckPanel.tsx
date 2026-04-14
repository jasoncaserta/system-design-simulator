import React from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

export const BottleneckPanel = () => {
  const { nodes } = useSimulatorStore();

  const overloadedNodes = nodes.filter(n => n.data.status === 'overloaded');
  const stressedNodes = nodes.filter(n => n.data.status === 'stressed');

  if (overloadedNodes.length === 0 && stressedNodes.length === 0) {
    return (
      <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
        <div className="flex items-center">
          <CheckCircle className="text-green-400 mr-3" size={20} />
          <p className="text-sm text-green-700 font-medium">System is healthy and handling current load.</p>
        </div>
      </div>
    );
  }

  const primaryFailure = overloadedNodes[0] || stressedNodes[0];

  const getRecommendation = (nodeId: string) => {
    switch (nodeId) {
      case 'lb': return "Increase Load Balancer capacity or add more LB instances if your cloud provider allows.";
      case 'app': return "Horizontal scaling: Add more App Server instances to distribute the CPU/Memory load.";
      case 'cache': return "Increase cache size, use a larger instance type, or improve the cache hit rate to reduce the amount of data stored.";
      case 'db': return "Read scaling: Add DB replicas and improve cache hit rate. Write scaling: Sharding or moving to a more performant DB engine.";
      default: return "Review the node's capacity and consider scaling vertically or horizontally.";
    }
  };

  return (
    <div className="space-y-4">
      {overloadedNodes.map(node => (
        <div key={node.id} className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <AlertTriangle className="text-red-400 mr-3 shrink-0" size={20} />
            <div>
              <p className="text-sm text-red-700 font-bold uppercase tracking-tight">CRITICAL: {node.data.label} Overloaded</p>
              <p className="text-xs text-red-600 mt-1">
                The node is receiving {node.data.currentLoad.toFixed(1)} QPS but only has capacity for {(node.data.instances * node.data.maxCapacityPerInstance).toFixed(1)} QPS.
              </p>
              <div className="mt-3 bg-white/50 p-2 rounded text-xs text-red-800">
                <strong>Fix:</strong> {getRecommendation(node.id)}
              </div>
            </div>
          </div>
        </div>
      ))}

      {overloadedNodes.length === 0 && stressedNodes.map(node => (
        <div key={node.id} className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <Info className="text-yellow-400 mr-3 shrink-0" size={20} />
            <div>
              <p className="text-sm text-yellow-700 font-bold uppercase tracking-tight">WARNING: {node.data.label} Stressed</p>
              <p className="text-xs text-yellow-600 mt-1">
                Load is at {((node.data.currentLoad / (node.data.instances * node.data.maxCapacityPerInstance)) * 100).toFixed(0)}% of total capacity.
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
