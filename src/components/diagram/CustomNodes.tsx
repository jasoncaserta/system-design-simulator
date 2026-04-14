import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { NodeData } from '../../store/types';
import { Server, Users, HardDrive, Database, Layers, MessageSquare, Activity } from 'lucide-react';
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
};

const StatusColors = {
  healthy: 'border-green-500 bg-green-50 dark:bg-green-900/20',
  stressed: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
  overloaded: 'border-red-500 bg-red-50 dark:bg-red-900/20',
  idle: 'border-gray-300 bg-gray-50 dark:bg-gray-800/20',
};

export const CustomNode = memo(({ data }: NodeProps<NodeData>) => {
  const Icon = IconMap[data.type] || Server;
  const statusColor = StatusColors[data.status];
  const isCluster = data.instances > 1;

  return (
    <div className="relative">
      <div className={cn(
        'px-4 py-3 shadow-lg rounded-md border-2 w-[220px] bg-white dark:bg-gray-900 transition-all duration-300 text-slate-900 dark:text-white',
        statusColor,
        isCluster ? 'border-b-4' : ''
      )}>
        {/* Instance Indicator Grid (replaces stacking) */}
        {isCluster && (
          <div className="flex flex-wrap gap-1 mb-2 border-b border-gray-100 dark:border-gray-800 pb-1.5">
            {Array.from({ length: Math.min(data.instances, 12) }).map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  data.status === 'overloaded' ? 'bg-red-400' : 
                  data.status === 'stressed' ? 'bg-yellow-400' : 'bg-blue-400'
                )} 
              />
            ))}
            {data.instances > 12 && (
              <span className="text-[8px] font-bold text-gray-400">+{data.instances - 12}</span>
            )}
          </div>
        )}

        <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-gray-400" />
        
        <div className="flex items-center">
          <div className="rounded-full p-2 bg-white dark:bg-gray-800 shadow-sm mr-2 border border-gray-100 dark:border-gray-800">
            <Icon size={16} className={cn(
              data.status === 'overloaded' ? 'text-red-500' : 
              data.status === 'stressed' ? 'text-yellow-500' : 'text-blue-500'
            )} />
          </div>
          <div className="ml-2">
            <div className="text-xs font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider">{data.label}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tight">
              {data.instances} {data.instances === 1 ? 'instance' : 'instances'}
            </div>
          </div>
        </div>

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
              {formatK(data.currentLoad)} <span className="text-[9px] font-normal uppercase opacity-60 ml-0.5">Queries / Sec</span>
            </span>
          </div>
        </div>

        <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-gray-400" />
      </div>
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
