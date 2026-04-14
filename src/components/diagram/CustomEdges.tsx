import { getBezierPath, MarkerType } from 'reactflow';
import type { EdgeProps } from 'reactflow';
import type { EdgeData } from '../../store/types';

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
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const qps = data?.qps || 0;
  
  // Constant speed for all connections
  const duration = 2.0; 
  const revDuration = 2.5;

  const edgeStyle = {
    ...style,
    strokeWidth: qps > 0 ? Math.min(48, 4 + Math.log10(qps + 1) * 8) : 3,
    transition: 'stroke-width 0.3s ease',
    stroke: qps > 0 ? '#3b82f6' : '#94a3b8',
    strokeOpacity: 0.3,
  };

  const [labelX, labelY] = [
    sourceX + (targetX - sourceX) * 0.5,
    sourceY + (targetY - sourceY) * 0.5,
  ];

  const formatQps = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    if (val < 1 && val > 0) return val.toFixed(2);
    return val.toFixed(1);
  };

  // Determine number of packets based on QPS
  const packetCount = qps > 0 ? Math.min(5, Math.max(1, Math.floor(Math.log10(qps + 1) * 2))) : 0;

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

      {qps > 0 && (
        <>
          {/* Animated "data flow" packets */}
          {Array.from({ length: packetCount }).map((_, i) => (
            <circle key={`p-fwd-${i}`} r={Math.min(4, 2 + Math.log10(qps + 1))} fill="#60a5fa">
              <animateMotion
                dur={`${duration}s`}
                repeatCount="indefinite"
                path={edgePath}
                begin={`${(i * duration) / packetCount}s`}
              />
            </circle>
          ))}

          {/* Subtle return flow (response) */}
          {Array.from({ length: Math.min(2, packetCount) }).map((_, i) => (
            <circle key={`p-rev-${i}`} r={Math.min(3, 1.5 + Math.log10(qps + 1))} fill="#93c5fd" opacity={0.4}>
              <animateMotion
                dur={`${revDuration}s`}
                repeatCount="indefinite"
                path={edgePath}
                begin={`${(i * revDuration) / 2}s`}
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
              <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-md border border-blue-200 dark:border-blue-800 flex items-center space-x-1 scale-90">
                <span className="text-[10px] font-mono font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  {formatQps(qps)}
                </span>
                <span className="text-[7px] font-bold text-gray-400 uppercase tracking-tighter">QPS</span>
              </div>
            </div>
          </foreignObject>
        </>
      )}
    </>
  );
  };

