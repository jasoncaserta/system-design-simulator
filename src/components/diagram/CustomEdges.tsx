import { getBezierPath } from 'reactflow';
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

  // Calculate animation duration based on QPS
  // Higher QPS = shorter duration (faster)
  // Base duration of 1.0s for 1 QPS, minimum 0.05s, maximum 5s
  const qps = data?.qps || 0;
  let duration = 0;
  if (qps > 0) {
    duration = Math.max(0.05, Math.min(5, 1 / (qps * 0.5)));
  }

  const edgeStyle = {
    ...style,
    strokeWidth: qps > 0 ? Math.min(5, 1 + Math.log10(qps + 1)) : 1,
    transition: 'stroke-width 0.3s ease',
  };

  return (
    <>
      <path
        id={id}
        style={edgeStyle}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {qps > 0 && (
        <path
          style={{
            ...edgeStyle,
            animationDuration: `${duration}s`,
          }}
          className="react-flow__edge-path animated custom-edge-animated"
          d={edgePath}
        />
      )}
    </>
  );
};
