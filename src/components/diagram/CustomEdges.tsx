import { getBezierPath, getSmoothStepPath } from 'reactflow';
import type { EdgeProps } from 'reactflow';
import type { EdgeData } from '../../store/types';
import { formatK } from '../../utils/format';

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
}: EdgeProps<EdgeData>) => {
  const throughput = data?.throughput || 0;
  const kind = data?.kind || 'request';
  const isRequestEdge = kind === 'request';
  const [edgePath, labelX, labelY] = isRequestEdge
    ? getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      })
    : getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 20,
        offset: 28,
      });

  const palette = isRequestEdge
    ? {
        stroke: '#3b82f6',
        strokeBorder: '#bfdbfe',
        forwardFill: '#60a5fa',
        reverseFill: '#93c5fd',
        labelText: '#2563eb',
      }
    : {
        stroke: '#f59e0b',
        strokeBorder: '#fde68a',
        forwardFill: '#fbbf24',
        reverseFill: '#fcd34d',
        labelText: '#d97706',
      };
  
  const duration = 2.0; 
  const revDuration = 2.5;

  const edgeStyle = {
    ...style,
    strokeWidth: throughput > 0 ? Math.min(48, 4 + Math.log10(throughput + 1) * 8) : 3,
    transition: 'stroke-width 0.3s ease',
    stroke: throughput > 0 ? palette.stroke : '#94a3b8',
    strokeOpacity: 0.3,
  };

  const packetCount = throughput > 0 ? Math.min(5, Math.max(1, Math.floor(Math.log10(throughput + 1) * 2))) : 0;

  return (
    <>
      {/* Base static path */}
      <path
        id={id}
        style={edgeStyle}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />

      {throughput > 0 && (
        <g key={`${id}-${edgePath}`}>
          {/* Forward traffic / movement */}
          {Array.from({ length: packetCount }).map((_, i) => (
            <circle key={`p-fwd-${i}`} r={Math.min(4, 2 + Math.log10(throughput + 1))} fill={palette.forwardFill}>
              <animateMotion
                dur={`${duration}s`}
                repeatCount="indefinite"
                path={edgePath}
                begin={`${-((i * duration) / packetCount)}s`}
              />
            </circle>
          ))}

          {isRequestEdge && Array.from({ length: Math.min(2, packetCount) }).map((_, i) => (
            <circle key={`p-rev-${i}`} r={Math.min(3, 1.5 + Math.log10(throughput + 1))} fill={palette.reverseFill} opacity={0.45}>
              <animateMotion
                dur={`${revDuration}s`}
                repeatCount="indefinite"
                path={edgePath}
                begin={`${-((i * revDuration) / 2)}s`}
                keyPoints="1;0"
                keyTimes="0;1"
                calcMode="linear"
              />
            </circle>
          ))}

          <foreignObject
            width={80}
            height={24}
            x={labelX - 40}
            y={labelY - 30}
            className="pointer-events-none"
            requiredExtensions="http://www.w3.org/1999/xhtml"
          >
            <div className="flex items-center justify-center h-full">
              <div
                className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-md border flex items-center space-x-1 scale-90"
                style={{ borderColor: palette.strokeBorder }}
              >
                <span className="text-[10px] font-mono font-black whitespace-nowrap" style={{ color: palette.labelText }}>
                  {formatK(throughput)}
                </span>
                <span className="text-[7px] font-bold text-gray-400 uppercase tracking-tighter">
                  {isRequestEdge ? 'REQ/S' : 'OPS/S'}
                </span>
              </div>
            </div>
          </foreignObject>
        </g>
      )}
    </>
  );
};
