import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { NodeData } from '../../store/types';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { NodeConfigPanel } from './NodeControls';
import {
  Archive,
  Cog,
  Cpu,
  Database,
  DatabaseZap,
  Gauge,
  Globe,
  MonitorSmartphone,
  Router,
  ServerCog,
  Waypoints,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { formatK } from '../../utils/format';

// Handle position constants
const HANDLE_POS = {
  UPPER: '34%',
  LOWER: '70%',
  LEFT_THIRD: '32%',
  RIGHT_THIRD: '68%',
} as const;

const IconMap = {
  client: MonitorSmartphone,
  'load-balancer': Router,
  service: ServerCog,
  cache: Gauge,
  'relational-db': Database,
  'nosql-db': DatabaseZap,
  'message-queue': Waypoints,
  worker: Cog,
  cdn: Globe,
  'object-store': Archive,
  'batch-processor': Cpu,
};

const TypeColors = {
  client: 'bg-sky-500',
  cdn: 'bg-sky-500',
  'load-balancer': 'bg-sky-500',
  service: 'bg-violet-500',
  cache: 'bg-violet-500',
  'relational-db': 'bg-amber-500',
  'nosql-db': 'bg-amber-500',
  'message-queue': 'bg-emerald-500',
  worker: 'bg-emerald-500',
  'object-store': 'bg-emerald-500',
  'batch-processor': 'bg-emerald-500',
} as const;

const StatusColors = {
  healthy: 'border-green-500 bg-green-50 dark:bg-green-900/20',
  stressed: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
  overloaded: 'border-red-500 bg-red-50 dark:bg-red-900/20',
  idle: 'border-gray-300 bg-gray-50 dark:bg-gray-800/20',
};

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-slate-300 dark:bg-slate-600" />
      <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.22em] text-slate-700 dark:text-slate-200">
        {title}
      </span>
      <div className="h-px flex-1 bg-slate-300 dark:bg-slate-600" />
    </div>
  );
}

const CustomNodeInner = ({ id, data }: NodeProps<NodeData>) => {
  const { showNodeConfig, updateImplementationLabel } = useSimulatorStore();
  const Icon = IconMap[data.type] || ServerCog;
  const statusColor = StatusColors[data.status];
  const typeColor = TypeColors[data.type] || 'bg-blue-500';
  const handleClassName = "w-2 h-2 !bg-gray-400 !opacity-0";

  const stackLayers = Math.min(data.instances, 4) - 1; // 0-3 shadow layers behind
  const loadPercent = (data.currentLoad / (data.instances * data.maxCapacityPerInstance)) * 100;

  return (
    <div className="relative">
      <Handle id="target-left" type="target" position={Position.Left} className={handleClassName} />
      <Handle id="target-top" type="target" position={Position.Top} className={handleClassName} />
      <Handle id="target-right" type="target" position={Position.Right} className={handleClassName} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className={handleClassName} />
      <Handle id="target-left-upper" type="target" position={Position.Left} className={handleClassName} style={{ top: HANDLE_POS.UPPER }} />
      <Handle id="target-left-lower" type="target" position={Position.Left} className={handleClassName} style={{ top: HANDLE_POS.LOWER }} />
      <Handle id="target-right-upper" type="target" position={Position.Right} className={handleClassName} style={{ top: HANDLE_POS.UPPER }} />
      <Handle id="target-right-lower" type="target" position={Position.Right} className={handleClassName} style={{ top: HANDLE_POS.LOWER }} />
      <Handle id="target-top-left" type="target" position={Position.Top} className={handleClassName} style={{ left: HANDLE_POS.LEFT_THIRD }} />
      <Handle id="target-top-right" type="target" position={Position.Top} className={handleClassName} style={{ left: HANDLE_POS.RIGHT_THIRD }} />

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
        'overflow-hidden rounded-md border-2 w-[220px] shadow-lg isolate transition-all duration-300 text-slate-900 dark:text-white relative',
        statusColor,
      )}>
        <div className="absolute inset-0 bg-white/18 dark:bg-slate-950/18" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.05))] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.04),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(2,6,23,0.10))]" />

        <div className="relative px-4 py-3">
          <div className="flex items-center">
            <div
              className={cn(
                'rounded-full p-2 shadow-sm mr-2 border border-gray-100 dark:border-gray-800',
                typeColor,
              )}
            >
              <Icon size={20} className="text-white" />
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
            <div className="mt-2">
              <div className="space-y-2 rounded-md border border-slate-200/70 bg-slate-100/75 px-2 py-2 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/55">
                <SectionTitle title="Load" />
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Utilization</span>
                  <span className="text-[10px] font-bold font-mono text-slate-900 dark:text-white">
                    {loadPercent.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      data.status === 'overloaded' ? 'bg-red-500' :
                      data.status === 'stressed' ? 'bg-yellow-500' : 'bg-green-500'
                    )}
                    style={{ width: `${Math.min(100, loadPercent)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Throughput</span>
                  <span className="text-[10px] font-bold font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {formatK(data.currentLoad)} <span className="text-[9px] font-normal uppercase opacity-60 ml-0.5">Ops / Sec</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {showNodeConfig && <NodeConfigPanel nodeType={data.type} tierId={id} />}
        </div>
      </div>

      <Handle id="source-left" type="source" position={Position.Left} className={handleClassName} />
      <Handle id="source-top" type="source" position={Position.Top} className={handleClassName} />
      <Handle id="source-right" type="source" position={Position.Right} className={handleClassName} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={handleClassName} />
      <Handle id="source-right-upper" type="source" position={Position.Right} className={handleClassName} style={{ top: HANDLE_POS.UPPER }} />
      <Handle id="source-right-lower" type="source" position={Position.Right} className={handleClassName} style={{ top: HANDLE_POS.LOWER }} />
      <Handle id="source-top-left" type="source" position={Position.Top} className={handleClassName} style={{ left: HANDLE_POS.LEFT_THIRD }} />
      <Handle id="source-top-right" type="source" position={Position.Top} className={handleClassName} style={{ left: HANDLE_POS.RIGHT_THIRD }} />
    </div>
  );
};

export const CustomNode = memo(CustomNodeInner);
CustomNode.displayName = 'CustomNode';
