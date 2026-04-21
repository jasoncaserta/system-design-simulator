import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { NodeData } from '../../store/types';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { NodeConfigPanel } from './NodeControls';
import { Server, Users, HardDrive, Database, Layers, MessageSquare, Activity, Globe, Box, RefreshCcw, History, RotateCw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatK } from '../../utils/format';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const IconMap = {
  client: Users,
  lb: Layers,
  app: Server,
  cache: Activity,
  db: Database,
  queue: MessageSquare,
  worker: HardDrive,
  cdn: Globe,
  'blob-storage': Box,
  recompute: RefreshCcw,
  bootstrap: RotateCw,
  history: History,
};

const StatusColors = {
  healthy: 'border-green-500 bg-green-50 dark:bg-green-900/20',
  stressed: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
  overloaded: 'border-red-500 bg-red-50 dark:bg-red-900/20',
  idle: 'border-gray-300 bg-gray-50 dark:bg-gray-800/20',
};

export const CustomNode = ({ id, data }: NodeProps<NodeData>) => {
  const { showNodeConfig, updateImplementationLabel } = useSimulatorStore();
  const Icon = IconMap[data.type] || Server;
  const statusColor = StatusColors[data.status];
  const isCluster = data.instances > 1;
  const handleClassName = "w-2 h-2 !bg-gray-400 !opacity-0";
  const isDerivedStateNode = data.type === 'recompute';

  const stackLayers = Math.min(data.instances, 4) - 1; // 0-3 shadow layers behind

  return (
    <div className="relative">
      <Handle id="target-left" type="target" position={Position.Left} className={handleClassName} />
      <Handle id="target-top" type="target" position={Position.Top} className={handleClassName} />
      <Handle id="target-right" type="target" position={Position.Right} className={handleClassName} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className={handleClassName} />
      <Handle id="target-left-upper" type="target" position={Position.Left} className={handleClassName} style={{ top: '34%' }} />
      <Handle id="target-left-lower" type="target" position={Position.Left} className={handleClassName} style={{ top: '70%' }} />
      <Handle id="target-right-upper" type="target" position={Position.Right} className={handleClassName} style={{ top: '34%' }} />
      <Handle id="target-right-lower" type="target" position={Position.Right} className={handleClassName} style={{ top: '70%' }} />
      <Handle id="target-top-left" type="target" position={Position.Top} className={handleClassName} style={{ left: '32%' }} />
      <Handle id="target-top-right" type="target" position={Position.Top} className={handleClassName} style={{ left: '68%' }} />
      {isDerivedStateNode && (
        <>
          <Handle id="target-derived-top-left" type="target" position={Position.Top} className={handleClassName} style={{ left: '32%' }} />
          <Handle id="target-derived-top-right" type="target" position={Position.Top} className={handleClassName} style={{ left: '68%' }} />
          <Handle id="target-derived-left-upper" type="target" position={Position.Left} className={handleClassName} style={{ top: '34%' }} />
          <Handle id="target-derived-left-lower" type="target" position={Position.Left} className={handleClassName} style={{ top: '70%' }} />
        </>
      )}

      {/* Stacked card shadows for multi-instance */}
      {Array.from({ length: stackLayers }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'absolute w-[220px] h-full rounded-md border-2 bg-white dark:bg-gray-900',
            statusColor,
          )}
          style={{
            top: (i + 1) * -4,
            left: (i + 1) * 4,
            zIndex: -(i + 1),
            opacity: 1 - (i + 1) * 0.2,
          }}
        />
      ))}

      <div className={cn(
        'px-4 py-3 shadow-lg rounded-md border-2 w-[220px] bg-white dark:bg-gray-900 transition-all duration-300 text-slate-900 dark:text-white relative',
        statusColor,
      )}>

        <div className="flex items-center">
          <div className="rounded-full p-2 bg-white dark:bg-gray-800 shadow-sm mr-2 border border-gray-100 dark:border-gray-800">
            <Icon size={16} className={cn(
              data.status === 'overloaded' ? 'text-red-500' : 
              data.status === 'stressed' ? 'text-yellow-500' : 'text-blue-500'
            )} />
          </div>
          <div className="ml-2">
            <div className="text-xs font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider">{data.label}</div>
            {data.implementationLabel != null && (
              showNodeConfig ? (
                <input
                  className="nodrag text-[9px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 outline-none w-full focus:border-blue-400"
                  value={data.implementationLabel}
                  onChange={(e) => updateImplementationLabel(id, e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="text-[9px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                  {data.implementationLabel}
                </div>
              )
            )}
          </div>
        </div>

        {data.type !== 'client' && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Load Info</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                 {((data.currentLoad / (data.instances * data.maxCapacityPerInstance)) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  data.status === 'overloaded' ? 'bg-red-500' :
                  data.status === 'stressed' ? 'bg-yellow-500' : 'bg-green-500'
                )}
                style={{ width: `${Math.min(100, (data.currentLoad / (data.instances * data.maxCapacityPerInstance)) * 100)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-end">
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                {formatK(data.currentLoad)} <span className="text-[9px] font-normal uppercase opacity-60 ml-0.5">Ops / Sec</span>
              </span>
            </div>
          </div>
        )}

        {showNodeConfig && <NodeConfigPanel nodeType={data.type} tierId={id} />}
      </div>

      <Handle id="source-left" type="source" position={Position.Left} className={handleClassName} />
      <Handle id="source-top" type="source" position={Position.Top} className={handleClassName} />
      <Handle id="source-right" type="source" position={Position.Right} className={handleClassName} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={handleClassName} />
      <Handle id="source-right-upper" type="source" position={Position.Right} className={handleClassName} style={{ top: '34%' }} />
      <Handle id="source-right-lower" type="source" position={Position.Right} className={handleClassName} style={{ top: '70%' }} />
      <Handle id="source-top-left" type="source" position={Position.Top} className={handleClassName} style={{ left: '32%' }} />
      <Handle id="source-top-right" type="source" position={Position.Top} className={handleClassName} style={{ left: '68%' }} />
      {isDerivedStateNode && (
        <>
          <Handle id="source-derived-top-left" type="source" position={Position.Top} className={handleClassName} style={{ left: '32%' }} />
          <Handle id="source-derived-right-upper" type="source" position={Position.Right} className={handleClassName} style={{ top: '34%' }} />
        </>
      )}
    </div>
  );
};
