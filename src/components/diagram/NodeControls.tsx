import { useSimulatorStore } from '../../store/useSimulatorStore';
import type { NodeType } from '../../store/types';
import { formatK } from '../../utils/format';
import {
  cadenceOptions,
  jobCostOptions,
  backfillOptions,
  recoveryOptions,
  sizes,
  stepThroughOptions,
  getBaseCapacity,
  getInstanceSize,
} from '../controls/controlOptions';

const btnClass =
  'w-5 h-5 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm hover:bg-gray-50 text-slate-900 dark:text-white text-[10px] disabled:opacity-30 disabled:cursor-not-allowed';

const labelClass = 'text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';
const valueClass = 'text-[10px] font-bold font-mono text-slate-900 dark:text-white';

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
    sourceJobTypes,
    refreshCadence,
    averageJobCost,
    derivedStateCadence,
    backfillMode,
    recoveryMode,
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
      className="nodrag nowheel mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Client controls */}
      {nodeType === 'client' && (
        <>
          <Stepper
            label="Users"
            value={users >= 1000 ? `${(users / 1000).toFixed(0)}K` : String(users)}
            onDecrement={() => updateSimParams({ users: Math.max(1000, users / 10) })}
            onIncrement={() => updateSimParams({ users: Math.min(1000000, users * 10) })}
            disableMin={users <= 1000}
            disableMax={users >= 1000000}
          />
          <Slider
            label="RPS / User"
            value={rpsPerUser}
            onChange={(v) => updateSimParams({ rpsPerUser: v })}
            min={0.01}
            max={2.0}
            step={0.01}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Read/Write"
            value={readWriteRatio}
            onChange={(v) => updateSimParams({ readWriteRatio: v })}
          />
          <div className="flex items-center justify-between pt-1">
            <span className={labelClass}>Total Req/Sec</span>
            <span className={valueClass}>{formatK(users * rpsPerUser)}</span>
          </div>
        </>
      )}

      {/* Instance controls — all infrastructure nodes */}
      {nodeType !== 'client' && (
        <>
          <Stepper
            label="Instances"
            value={String(count)}
            onDecrement={() => updateNodeInstances(cleanId, count - 1)}
            onIncrement={() => updateNodeInstances(cleanId, count + 1)}
            disableMin={count <= 1}
          />
          <Stepper
            label="Size"
            value={size}
            onDecrement={() => changeSize(-1)}
            onIncrement={() => changeSize(1)}
            disableMin={sizeIndex <= 0}
            disableMax={sizeIndex >= sizes.length - 1}
          />
        </>
      )}

      {/* Node-specific controls */}
      {nodeType === 'cache' && (
        <Slider
          label="Hit Rate"
          value={cacheHitRate}
          onChange={(v) => updateSimParams({ cacheHitRate: v })}
        />
      )}

      {nodeType === 'cdn' && (
        <Slider
          label="Hit Rate"
          value={cdnHitRate}
          onChange={(v) => updateSimParams({ cdnHitRate: v })}
        />
      )}

      {nodeType === 'worker' && (
        <>
          <Stepper
            label="Job Types"
            value={String(sourceJobTypes)}
            onDecrement={() => updateSimParams({ sourceJobTypes: Math.max(0, sourceJobTypes - 1) })}
            onIncrement={() => updateSimParams({ sourceJobTypes: Math.min(12, sourceJobTypes + 1) })}
            disableMin={sourceJobTypes <= 0}
            disableMax={sourceJobTypes >= 12}
          />
          <Stepper
            label="Job Cost"
            value={jobCostOptions.find((o) => o.value === averageJobCost)!.label}
            onDecrement={() => updateSimParams({ averageJobCost: stepThroughOptions(jobCostOptions, averageJobCost, -1) })}
            onIncrement={() => updateSimParams({ averageJobCost: stepThroughOptions(jobCostOptions, averageJobCost, 1) })}
            disableMin={averageJobCost === 'light'}
            disableMax={averageJobCost === 'very_heavy'}
          />
        </>
      )}

      {nodeType === 'queue' && (
        <>
          <Stepper
            label="Cadence"
            value={cadenceOptions.find((o) => o.value === refreshCadence)!.label}
            onDecrement={() => updateSimParams({ refreshCadence: stepThroughOptions(cadenceOptions, refreshCadence, -1) })}
            onIncrement={() => updateSimParams({ refreshCadence: stepThroughOptions(cadenceOptions, refreshCadence, 1) })}
            disableMin={refreshCadence === 'rare'}
            disableMax={refreshCadence === 'continuous'}
          />
          <Stepper
            label="Concurrency"
            value={String(maxBackgroundConcurrency)}
            onDecrement={() => updateSimParams({ maxBackgroundConcurrency: Math.max(1, maxBackgroundConcurrency - 1) })}
            onIncrement={() => updateSimParams({ maxBackgroundConcurrency: Math.min(8, maxBackgroundConcurrency + 1) })}
            disableMin={maxBackgroundConcurrency <= 1}
            disableMax={maxBackgroundConcurrency >= 8}
          />
        </>
      )}

      {nodeType === 'recompute' && (
        <Stepper
          label="Refresh"
          value={cadenceOptions.find((o) => o.value === derivedStateCadence)!.label}
          onDecrement={() => updateSimParams({ derivedStateCadence: stepThroughOptions(cadenceOptions, derivedStateCadence, -1) })}
          onIncrement={() => updateSimParams({ derivedStateCadence: stepThroughOptions(cadenceOptions, derivedStateCadence, 1) })}
          disableMin={derivedStateCadence === 'rare'}
          disableMax={derivedStateCadence === 'continuous'}
        />
      )}

      {nodeType === 'history' && (
        <Stepper
          label="Backfill"
          value={backfillOptions.find((o) => o.value === backfillMode)!.label}
          onDecrement={() => updateSimParams({ backfillMode: stepThroughOptions(backfillOptions, backfillMode, -1) })}
          onIncrement={() => updateSimParams({ backfillMode: stepThroughOptions(backfillOptions, backfillMode, 1) })}
          disableMin={backfillMode === 'off'}
          disableMax={backfillMode === 'aggressive'}
        />
      )}

      {nodeType === 'bootstrap' && (
        <Stepper
          label="Recovery"
          value={recoveryOptions.find((o) => o.value === recoveryMode)!.label}
          onDecrement={() => updateSimParams({ recoveryMode: stepThroughOptions(recoveryOptions, recoveryMode, -1) })}
          onIncrement={() => updateSimParams({ recoveryMode: stepThroughOptions(recoveryOptions, recoveryMode, 1) })}
          disableMin={recoveryMode === 'off'}
          disableMax={recoveryMode === 'rebuild'}
        />
      )}

      {nodeType === 'db' && (nodeCounts.queue > 0 || nodeCounts.worker > 0) && (
        <Toggle
          label="Read Priority Gate"
          value={enableApiPriorityGate}
          onChange={(v) => updateSimParams({ enableApiPriorityGate: v })}
        />
      )}
    </div>
  );
};
