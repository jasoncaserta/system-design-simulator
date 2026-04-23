import { getBezierPath } from 'reactflow';
import type { EdgeProps } from 'reactflow';
import type { EdgeData } from '../../store/types';
import { formatK } from '../../utils/format';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { X } from 'lucide-react';

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps<EdgeData>) => {
  const onEdgesChange = useSimulatorStore((s) => s.onEdgesChange);
  const updateEdgeKind = useSimulatorStore((s) => s.updateEdgeKind);

  const throughput = data?.throughput || 0;
  const kind = data?.kind || 'request';
  const isRequestEdge = kind === 'request';
  const isUserEdge = id.startsWith('user-');

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: isRequestEdge ? 0.28 : 0.18,
  });

  const palette = isRequestEdge
    ? { stroke: '#3b82f6', strokeBorder: '#bfdbfe', forwardFill: '#60a5fa', reverseFill: '#93c5fd', labelText: '#2563eb' }
    : { stroke: '#f59e0b', strokeBorder: '#fde68a', forwardFill: '#fbbf24', reverseFill: '#fcd34d', labelText: '#d97706' };

  const duration = 2.0;
  const revDuration = 2.5;
  const packetCount = throughput > 0 ? Math.min(5, Math.max(1, Math.floor(Math.log10(throughput + 1) * 2))) : 0;

  const edgeStyle = {
    ...style,
    strokeWidth: selected ? Math.min(48, 4 + Math.log10(throughput + 1) * 8) + 2 : throughput > 0 ? Math.min(48, 4 + Math.log10(throughput + 1) * 8) : 3,
    transition: 'stroke-width 0.3s ease',
    stroke: selected ? (isRequestEdge ? '#2563eb' : '#d97706') : throughput > 0 ? palette.stroke : '#94a3b8',
    strokeOpacity: selected ? 0.6 : 0.3,
  };

  return (
    <>
      <path id={id} style={edgeStyle} className="react-flow__edge-path" d={edgePath} markerEnd={markerEnd} />

      {throughput > 0 && !selected && (
        <g key={`${id}-${edgePath}`}>
          {Array.from({ length: packetCount }).map((_, i) => (
            <circle key={`p-fwd-${i}`} r={Math.min(4, 2 + Math.log10(throughput + 1))} fill={palette.forwardFill}>
              <animateMotion dur={`${duration}s`} repeatCount="indefinite" path={edgePath} begin={`${-((i * duration) / packetCount)}s`} />
            </circle>
          ))}
          {isRequestEdge && Array.from({ length: Math.min(2, packetCount) }).map((_, i) => (
            <circle key={`p-rev-${i}`} r={Math.min(3, 1.5 + Math.log10(throughput + 1))} fill={palette.reverseFill} opacity={0.45}>
              <animateMotion dur={`${revDuration}s`} repeatCount="indefinite" path={edgePath} begin={`${-((i * revDuration) / 2)}s`} keyPoints="1;0" keyTimes="0;1" calcMode="linear" />
            </circle>
          ))}
          <foreignObject width={80} height={24} x={labelX - 40} y={labelY - 30} className="pointer-events-none" requiredExtensions="http://www.w3.org/1999/xhtml">
            <div className="flex items-center justify-center h-full">
              <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-md border flex items-center space-x-1 scale-90" style={{ borderColor: palette.strokeBorder }}>
                <span className="text-[10px] font-mono font-black whitespace-nowrap" style={{ color: palette.labelText }}>{formatK(throughput)}</span>
                <span className="text-[7px] font-bold text-gray-400 uppercase tracking-tighter">{isRequestEdge ? 'REQ/S' : 'OPS/S'}</span>
              </div>
            </div>
          </foreignObject>
        </g>
      )}

      {selected && (
        <foreignObject width={isUserEdge ? 200 : 72} height={32} x={labelX - (isUserEdge ? 100 : 36)} y={labelY - 16} requiredExtensions="http://www.w3.org/1999/xhtml">
          <div className="flex items-center gap-1 h-full">
            {isUserEdge && (
              <>
                <button
                  onClick={() => updateEdgeKind(id, 'request')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-l-full border cursor-pointer transition-colors ${
                    isRequestEdge
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  }`}
                >
                  Request
                </button>
                <button
                  onClick={() => updateEdgeKind(id, 'data')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-r-full border cursor-pointer transition-colors ${
                    !isRequestEdge
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-amber-400'
                  }`}
                >
                  Data
                </button>
              </>
            )}
            <button
              onClick={() => onEdgesChange([{ type: 'remove', id }])}
              className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer transition-colors"
            >
              <X size={11} />
            </button>
          </div>
        </foreignObject>
      )}
    </>
  );
};
