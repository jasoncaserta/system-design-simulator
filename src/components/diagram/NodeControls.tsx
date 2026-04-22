import type { ReactNode } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import type { NodeType } from '../../store/types';
import { formatK } from '../../utils/format';
import {
  cadenceOptions,
  jobCostOptions,
  backfillOptions,
  recoveryOptions,
  processingModeOptions,
  replicationModeOptions,
  sizes,
  stepThroughOptions,
  getBaseCapacity,
  getInstanceSize,
} from '../controls/controlOptions';

const btnClass =
  'w-5 h-5 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm hover:bg-gray-50 text-slate-900 dark:text-white text-[10px] disabled:opacity-30 disabled:cursor-not-allowed';

const labelClass = 'text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';
const valueClass = 'text-[10px] font-bold font-mono text-slate-900 dark:text-white';

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

function ControlSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border border-slate-200/70 bg-slate-100/75 px-2 py-2 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/55">
      {title && <SectionTitle title={title} />}
      {children}
    </div>
  );
}

const getCapacityLabel = (nodeType: NodeType) => {
  switch (nodeType) {
    case 'cdn': return 'Capacity';
    case 'cache': return 'Capacity';
    case 'relational-db': return 'Capacity';
    case 'nosql-db': return 'Capacity';
    case 'object-store': return 'Capacity';
    case 'message-queue': return 'Capacity';
    case 'worker': return 'Capacity';
    case 'batch-processor': return 'Capacity';
    default: return 'Capacity';
  }
};

const getInstancesLabel = (nodeType: NodeType) => {
  switch (nodeType) {
    case 'relational-db': return 'Followers';
    case 'nosql-db': return 'Nodes';
    case 'object-store': return 'Req Budget';
    case 'message-queue': return 'Brokers';
    default: return 'Replicas';
  }
};


function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
  disableMin,
  disableMax,
}: {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  disableMin?: boolean;
  disableMax?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={labelClass}>{label}</span>
      <div className="flex items-center space-x-1">
        <button onClick={onDecrement} className={btnClass} disabled={disableMin}>
          -
        </button>
        <span className={`${valueClass} w-14 text-center uppercase`}>{value}</span>
        <button onClick={onIncrement} className={btnClass} disabled={disableMax}>
          +
        </button>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={labelClass}>{label}</span>
        <span className={valueClass}>{format ? format(value) : `${(value * 100).toFixed(0)}%`}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={labelClass}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
          value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export const NodeConfigPanel = ({ nodeType, tierId }: { nodeType: NodeType; tierId: string }) => {
  const {
    users,
    rpsPerUser,
    readWriteRatio,
    cacheHitRate,
    cdnHitRate,
    cacheWorkingSetFit,
    cacheInvalidationRate,
    serviceFanout,
    sourceJobTypes,
    refreshCadence,
    queueDepth,
    averageJobCost,
    retryRate,
    batchSize,
    derivedStateCadence,
    backfillMode,
    recoveryMode,
    processorLag,
    processingMode,
    databaseShardCount,
    nosqlPartitionCount,
    databaseWriteLoad,
    relationalReplicationMode,
    objectStoreThroughput,
    objectStoreScanCost,
    maxBackgroundConcurrency,
    enableApiPriorityGate,
    updateSimParams,
    nodeCounts,
    nodeCapacities,
    updateNodeInstances,
    updateNodeCapacity,
  } = useSimulatorStore();

  const cleanId = tierId.replace(/-[0-9]+$/, '');
  const count = nodeCounts[cleanId] ?? 0;
  const base = getBaseCapacity(cleanId);
  const currentCapacity = nodeCapacities[cleanId] || base;
  const size = getInstanceSize(currentCapacity, base);
  const sizeIndex = sizes.findIndex((s) => s.label === size);

  const changeSize = (delta: number) => {
    const nextIndex = Math.max(0, Math.min(sizes.length - 1, sizeIndex + delta));
    updateNodeCapacity(cleanId, base * sizes[nextIndex].mult);
  };

  return (
    <div
      className="nodrag nowheel mt-2 space-y-2"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Client controls */}
      {nodeType === 'client' && (
        <ControlSection>
          <Stepper
            label="Users"
            value={users >= 1000 ? `${(users / 1000).toFixed(0)}K` : String(users)}
            onDecrement={() => updateSimParams({ users: Math.max(1000, users / 10) })}
            onIncrement={() => updateSimParams({ users: Math.min(1000000, users * 10) })}
            disableMin={users <= 1000}
            disableMax={users >= 1000000}
          />
          <Slider
            label="Req / User"
            value={rpsPerUser}
            onChange={(v) => updateSimParams({ rpsPerUser: v })}
            min={0.01}
            max={2.0}
            step={0.01}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Read Share"
            value={readWriteRatio}
            onChange={(v) => updateSimParams({ readWriteRatio: v })}
          />
          <div className="flex items-center justify-between pt-1">
            <span className={labelClass}>Total QPS</span>
            <span className={valueClass}>{formatK(users * rpsPerUser)}</span>
          </div>
        </ControlSection>
      )}

      {/* Instance controls — all infrastructure nodes */}
      {nodeType !== 'client' && (
        <ControlSection title="Scale">
          <Stepper
            label={getCapacityLabel(nodeType)}
            value={size}
            onDecrement={() => changeSize(-1)}
            onIncrement={() => changeSize(1)}
            disableMin={sizeIndex <= 0}
            disableMax={sizeIndex >= sizes.length - 1}
          />
          <Stepper
            label={getInstancesLabel(nodeType)}
            value={String(count)}
            onDecrement={() => updateNodeInstances(cleanId, count - 1)}
            onIncrement={() => updateNodeInstances(cleanId, count + 1)}
            disableMin={count <= 1}
          />
        </ControlSection>
      )}

      {/* Node-specific controls */}
      {nodeType === 'cache' && (
        <ControlSection title="Config">
          <Slider
            label="Hit Rate"
            value={cacheHitRate}
            onChange={(v) => updateSimParams({ cacheHitRate: v })}
          />
          <Slider
            label="Working Set Fit"
            value={cacheWorkingSetFit}
            onChange={(v) => updateSimParams({ cacheWorkingSetFit: v })}
          />
          <Slider
            label="Invalidation"
            value={cacheInvalidationRate}
            onChange={(v) => updateSimParams({ cacheInvalidationRate: v })}
          />
        </ControlSection>
      )}

      {nodeType === 'cdn' && (
        <ControlSection title="Config">
          <Slider
            label="Hit Rate"
            value={cdnHitRate}
            onChange={(v) => updateSimParams({ cdnHitRate: v })}
          />
        </ControlSection>
      )}

      {nodeType === 'service' && (
        <ControlSection title="Config">
          <Stepper
            label="Fanout"
            value={String(serviceFanout)}
            onDecrement={() => updateSimParams({ serviceFanout: Math.max(1, serviceFanout - 1) })}
            onIncrement={() => updateSimParams({ serviceFanout: Math.min(8, serviceFanout + 1) })}
            disableMin={serviceFanout <= 1}
            disableMax={serviceFanout >= 8}
          />
        </ControlSection>
      )}

      {nodeType === 'worker' && (
        <ControlSection title="Config">
          <Stepper
            label="Upstreams"
            value={String(sourceJobTypes)}
            onDecrement={() => updateSimParams({ sourceJobTypes: Math.max(0, sourceJobTypes - 1) })}
            onIncrement={() => updateSimParams({ sourceJobTypes: Math.min(12, sourceJobTypes + 1) })}
            disableMin={sourceJobTypes <= 0}
            disableMax={sourceJobTypes >= 12}
          />
          <Stepper
            label="Task Cost"
            value={jobCostOptions.find((o) => o.value === averageJobCost)!.label}
            onDecrement={() => updateSimParams({ averageJobCost: stepThroughOptions(jobCostOptions, averageJobCost, -1) })}
            onIncrement={() => updateSimParams({ averageJobCost: stepThroughOptions(jobCostOptions, averageJobCost, 1) })}
            disableMin={averageJobCost === 'light'}
            disableMax={averageJobCost === 'very_heavy'}
          />
          <Slider
            label="Retry Rate"
            value={retryRate}
            onChange={(v) => updateSimParams({ retryRate: v })}
            max={0.5}
            step={0.05}
          />
          <Stepper
            label="Batch Size"
            value={String(batchSize)}
            onDecrement={() => updateSimParams({ batchSize: Math.max(1, batchSize - 1) })}
            onIncrement={() => updateSimParams({ batchSize: Math.min(8, batchSize + 1) })}
            disableMin={batchSize <= 1}
            disableMax={batchSize >= 8}
          />
        </ControlSection>
      )}

      {nodeType === 'message-queue' && (
        <ControlSection title="Config">
          <Stepper
            label="Dispatch Rate"
            value={cadenceOptions.find((o) => o.value === refreshCadence)!.label}
            onDecrement={() => updateSimParams({ refreshCadence: stepThroughOptions(cadenceOptions, refreshCadence, -1) })}
            onIncrement={() => updateSimParams({ refreshCadence: stepThroughOptions(cadenceOptions, refreshCadence, 1) })}
            disableMin={refreshCadence === 'rare'}
            disableMax={refreshCadence === 'continuous'}
          />
          <Stepper
            label="Parallelism"
            value={String(maxBackgroundConcurrency)}
            onDecrement={() => updateSimParams({ maxBackgroundConcurrency: Math.max(1, maxBackgroundConcurrency - 1) })}
            onIncrement={() => updateSimParams({ maxBackgroundConcurrency: Math.min(8, maxBackgroundConcurrency + 1) })}
            disableMin={maxBackgroundConcurrency <= 1}
            disableMax={maxBackgroundConcurrency >= 8}
          />
          <Slider
            label="Queue Depth"
            value={queueDepth}
            onChange={(v) => updateSimParams({ queueDepth: v })}
          />
        </ControlSection>
      )}

      {nodeType === 'relational-db' && (
        <ControlSection title="Config">
          <Stepper
            label="Replication"
            value={replicationModeOptions.find((o) => o.value === relationalReplicationMode)!.label}
            onDecrement={() => updateSimParams({ relationalReplicationMode: stepThroughOptions(replicationModeOptions, relationalReplicationMode, -1) })}
            onIncrement={() => updateSimParams({ relationalReplicationMode: stepThroughOptions(replicationModeOptions, relationalReplicationMode, 1) })}
            disableMin={relationalReplicationMode === 'single_leader'}
            disableMax={relationalReplicationMode === 'leader_follower'}
          />
          <Stepper
            label="Shards"
            value={String(databaseShardCount)}
            onDecrement={() => updateSimParams({ databaseShardCount: Math.max(1, databaseShardCount - 1) })}
            onIncrement={() => updateSimParams({ databaseShardCount: Math.min(8, databaseShardCount + 1) })}
            disableMin={databaseShardCount <= 1}
            disableMax={databaseShardCount >= 8}
          />
          <Slider
            label="Write Load"
            value={databaseWriteLoad}
            onChange={(v) => updateSimParams({ databaseWriteLoad: v })}
          />
          {(nodeCounts['message-queue'] > 0 || nodeCounts.worker > 0 || nodeCounts['batch-processor'] > 0) && (
            <Toggle
              label="Read Priority"
              value={enableApiPriorityGate}
              onChange={(v) => updateSimParams({ enableApiPriorityGate: v })}
            />
          )}
        </ControlSection>
      )}

      {nodeType === 'nosql-db' && (
        <ControlSection title="Config">
          <Stepper
            label="Partitions"
            value={String(nosqlPartitionCount)}
            onDecrement={() => updateSimParams({ nosqlPartitionCount: Math.max(1, nosqlPartitionCount - 1) })}
            onIncrement={() => updateSimParams({ nosqlPartitionCount: Math.min(12, nosqlPartitionCount + 1) })}
            disableMin={nosqlPartitionCount <= 1}
            disableMax={nosqlPartitionCount >= 12}
          />
        </ControlSection>
      )}

      {nodeType === 'object-store' && (
        <ControlSection title="Config">
          <Slider
            label="Throughput"
            value={objectStoreThroughput}
            onChange={(v) => updateSimParams({ objectStoreThroughput: v })}
          />
          <Slider
            label="Scan Cost"
            value={objectStoreScanCost}
            onChange={(v) => updateSimParams({ objectStoreScanCost: v })}
          />
        </ControlSection>
      )}

      {nodeType === 'batch-processor' && (
        <ControlSection title="Config">
          <Stepper
            label="Refresh Cadence"
            value={cadenceOptions.find((o) => o.value === derivedStateCadence)!.label}
            onDecrement={() => updateSimParams({ derivedStateCadence: stepThroughOptions(cadenceOptions, derivedStateCadence, -1) })}
            onIncrement={() => updateSimParams({ derivedStateCadence: stepThroughOptions(cadenceOptions, derivedStateCadence, 1) })}
            disableMin={derivedStateCadence === 'rare'}
            disableMax={derivedStateCadence === 'continuous'}
          />
          <Stepper
            label="Backfill"
            value={backfillOptions.find((o) => o.value === backfillMode)!.label}
            onDecrement={() => updateSimParams({ backfillMode: stepThroughOptions(backfillOptions, backfillMode, -1) })}
            onIncrement={() => updateSimParams({ backfillMode: stepThroughOptions(backfillOptions, backfillMode, 1) })}
            disableMin={backfillMode === 'off'}
            disableMax={backfillMode === 'aggressive'}
          />
          <Stepper
            label="Replay"
            value={recoveryOptions.find((o) => o.value === recoveryMode)!.label}
            onDecrement={() => updateSimParams({ recoveryMode: stepThroughOptions(recoveryOptions, recoveryMode, -1) })}
            onIncrement={() => updateSimParams({ recoveryMode: stepThroughOptions(recoveryOptions, recoveryMode, 1) })}
            disableMin={recoveryMode === 'off'}
            disableMax={recoveryMode === 'rebuild'}
          />
          <Slider
            label="Lag"
            value={processorLag}
            onChange={(v) => updateSimParams({ processorLag: v })}
          />
          <Stepper
            label="Mode"
            value={processingModeOptions.find((o) => o.value === processingMode)!.label}
            onDecrement={() => updateSimParams({ processingMode: stepThroughOptions(processingModeOptions, processingMode, -1) })}
            onIncrement={() => updateSimParams({ processingMode: stepThroughOptions(processingModeOptions, processingMode, 1) })}
            disableMin={processingMode === 'batch'}
            disableMax={processingMode === 'stream'}
          />
        </ControlSection>
      )}

    </div>
  );
};
