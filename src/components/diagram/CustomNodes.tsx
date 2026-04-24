import { memo } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { NodeData, HealthState } from '../../store/types';
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
  X,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { formatK } from '../../utils/format';

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

const HEALTH_LABELS: Record<HealthState, string> = { healthy: 'Up', degraded: 'Deg', unavailable: 'Down' };

const NON_REMOVABLE_NODE_IDS = new Set(['client']);

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
  const { showNodeConfig, updateImplementationLabel, setLayerEnabled, setNodeHealth } = useSimulatorStore();
  const Icon = IconMap[data.type] || ServerCog;
  const health = data.healthState || 'healthy';
  const isUnavailable = health === 'unavailable';
  const statusColor = isUnavailable
    ? 'border-gray-400 bg-gray-100 dark:bg-gray-900/40'
    : StatusColors[data.status];
  const typeColor = TypeColors[data.type] || 'bg-blue-500';
  const isConnecting = useStore(s => !!s.connectionNodeId);
  const handleBase = "!w-4 !h-4 !rounded-full !border-2 !border-white dark:!border-gray-900 !transition-all !duration-150";
  const handleVisibility = isConnecting
    ? "!opacity-80 !bg-blue-400"
    : "!bg-blue-500 !opacity-0 group-hover:!opacity-50 hover:!opacity-100";
  // Source handles get pointer-events-none while connecting so elementsFromPoint()
  // finds target handles first (same physical position, source is on top in DOM).
  const targetHandleClass = cn(handleBase, handleVisibility);
  const sourceHandleClass = cn(handleBase, handleVisibility, isConnecting && "!pointer-events-none");
  const canRemoveNode = !NON_REMOVABLE_NODE_IDS.has(id);

  const stackLayers = Math.min(data.instances, 4) - 1; // 0-3 shadow layers behind
  const loadPercent = (data.currentLoad / (data.instances * data.maxCapacityPerInstance)) * 100;

  return (
    <div className="relative group">
      <Handle id="target-left" type="target" position={Position.Left} className={targetHandleClass} />
      <Handle id="target-top" type="target" position={Position.Top} className={targetHandleClass} />
      <Handle id="target-right" type="target" position={Position.Right} className={targetHandleClass} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className={targetHandleClass} />

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
        isUnavailable ? 'border-dashed opacity-60' : health === 'degraded' ? 'border-dashed opacity-85' : '',
      )}>
        <div className="absolute inset-0 bg-white/18 dark:bg-slate-950/18" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.05))] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.04),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(2,6,23,0.10))]" />

        <div className="relative px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center min-w-0">
              <div
                className={cn(
                  'rounded-full p-2 shadow-sm mr-2 border border-gray-100 dark:border-gray-800',
                  typeColor,
                )}
              >
                <Icon size={20} className="text-white" />
              </div>
              <div className="ml-2 min-w-0">
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

            {showNodeConfig && canRemoveNode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLayerEnabled(id, false);
                }}
                className="nodrag shrink-0 p-1.5 rounded-full border border-red-200/80 dark:border-red-800/80 text-red-400 hover:text-red-500 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer bg-white/70 dark:bg-slate-900/50"
                aria-label={`Delete ${data.label}`}
                title={`Delete ${data.label}`}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {data.type !== 'client' && (
            <div className="mt-2">
              <div className="space-y-2 rounded-md border border-slate-200/70 bg-slate-100/75 px-2 py-2 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/55">
                <SectionTitle title="Load" />
                {isUnavailable ? (
                  <div className="flex items-center justify-center py-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 border border-dashed border-gray-400 dark:border-gray-500 rounded px-2 py-0.5">
                      Offline
                    </span>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
                {/* Staleness badge for DB nodes in leader_follower mode */}
                {(data.type === 'relational-db' || data.type === 'nosql-db') && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {data.stalenessRisk && (
                      <span className="text-[8px] font-black uppercase tracking-wide bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 rounded px-1.5 py-0.5">
                        ~Stale
                      </span>
                    )}
                    {data.consistencyModel === 'strong' && (
                      <span className="text-[8px] font-black uppercase tracking-wide bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 rounded px-1.5 py-0.5">
                        Sync
                      </span>
                    )}
                    {data.replicationLagMs != null && data.replicationLagMs > 0 && (
                      <span className="text-[8px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        lag ~{data.replicationLagMs}ms
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Latency display on client node */}
          {data.type === 'client' && data.latencyP50Ms != null && (
            <div className="mt-2">
              <div className="space-y-1.5 rounded-md border border-slate-200/70 bg-slate-100/75 px-2 py-2 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/55">
                <SectionTitle title="Latency" />
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">P50</span>
                  <span className="text-[10px] font-bold font-mono text-slate-900 dark:text-white">{data.latencyP50Ms}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">P99</span>
                  <span className={cn(
                    "text-[10px] font-bold font-mono",
                    data.latencyP99Ms != null && data.latencyP99Ms > 500 ? 'text-red-500' :
                    data.latencyP99Ms != null && data.latencyP99Ms > 200 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-slate-900 dark:text-white'
                  )}>{data.latencyP99Ms}ms</span>
                </div>
              </div>
            </div>
          )}

          {/* Health state toggles */}
          {showNodeConfig && data.type !== 'client' && (
            <div className="mt-1.5 nodrag">
              <div className="flex gap-1">
                {(['healthy', 'degraded', 'unavailable'] as HealthState[]).map((h) => (
                  <button
                    key={h}
                    onClick={(e) => { e.stopPropagation(); setNodeHealth(id, h); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={cn(
                      'flex-1 py-0.5 text-[8px] font-black uppercase tracking-wide rounded transition-colors cursor-pointer',
                      health === h
                        ? h === 'unavailable' ? 'bg-red-500 text-white'
                          : h === 'degraded' ? 'bg-amber-500 text-white'
                          : 'bg-green-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                    )}
                  >
                    {HEALTH_LABELS[h]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showNodeConfig && <NodeConfigPanel nodeType={data.type} tierId={id} />}
        </div>
      </div>

      <Handle id="source-left" type="source" position={Position.Left} className={sourceHandleClass} />
      <Handle id="source-top" type="source" position={Position.Top} className={sourceHandleClass} />
      <Handle id="source-right" type="source" position={Position.Right} className={sourceHandleClass} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={sourceHandleClass} />
    </div>
  );
};

export const CustomNode = memo(CustomNodeInner);
CustomNode.displayName = 'CustomNode';
