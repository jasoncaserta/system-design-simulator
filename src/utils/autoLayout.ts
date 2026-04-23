import type { XYPosition } from 'reactflow';

interface LayoutNode {
  id: string;
  order: number;
  width?: number;
  height?: number;
}

interface LayoutEdge {
  source: string;
  target: string;
  kind: 'request' | 'data';
}

interface Vector {
  x: number;
  y: number;
}

type Lane = 'spine' | 'serving' | 'background' | 'backgroundLow';

const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 170;
const NODE_MARGIN_X = 44;
const NODE_MARGIN_Y = 40;
const X_SPACING = 360;
const ITERATIONS = 90;
const MAX_STEP = 16;
const COLLISION_PUSH = 0.42;
const EDGE_NODE_PUSH = 0.38;
const REPULSION = 65_000;
const X_ANCHOR = 0.14;
const Y_ANCHOR = 0.06;
const SPRING = 0.012;
const DAMPING = 0.76;

const LANE_Y: Record<Lane, number> = {
  spine: -280,
  serving: 40,
  background: 430,
  backgroundLow: 760,
};

const TYPE_X_RANK: Record<string, number> = {
  client: 0,
  cdn: 1,
  'load-balancer': 2,
  service: 3,
  cache: 4.2,
  'relational-db': 6,
  'nosql-db': 6,
  'message-queue': 1.2,
  worker: 2.7,
  'object-store': 4.1,
  'batch-processor': 5.8,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getNodeWidth = (node: LayoutNode) => node.width ?? DEFAULT_NODE_WIDTH;
const getNodeHeight = (node: LayoutNode) => node.height ?? DEFAULT_NODE_HEIGHT;
const getNodePadX = (node: LayoutNode) => getNodeWidth(node) / 2 + NODE_MARGIN_X;
const getNodePadY = (node: LayoutNode) => getNodeHeight(node) / 2 + NODE_MARGIN_Y;

const magnitude = (vector: Vector) => Math.hypot(vector.x, vector.y);

const normalize = (vector: Vector): Vector => {
  const len = magnitude(vector) || 1;
  return { x: vector.x / len, y: vector.y / len };
};

const pointToSegmentDistance = (point: Vector, start: Vector, end: Vector) => {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const segmentLengthSq = segment.x * segment.x + segment.y * segment.y;
  if (segmentLengthSq === 0) {
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    return { distance: Math.hypot(dx, dy), closest: start, t: 0 };
  }

  const t = clamp(
    ((point.x - start.x) * segment.x + (point.y - start.y) * segment.y) / segmentLengthSq,
    0,
    1,
  );
  const closest = { x: start.x + segment.x * t, y: start.y + segment.y * t };
  const dx = point.x - closest.x;
  const dy = point.y - closest.y;
  return { distance: Math.hypot(dx, dy), closest, t };
};

const computeDepths = (nodes: LayoutNode[], edges: LayoutEdge[]) => {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  nodes.forEach((node) => {
    indegree.set(node.id, 0);
    outgoing.set(node.id, []);
  });

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) return;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)!.push(edge.target);
  });

  const queue = nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort((a, b) => a.order - b.order)
    .map((node) => node.id);

  const depth = new Map<string, number>();
  queue.forEach((id) => depth.set(id, 0));

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depth.get(current) ?? 0;
    for (const target of outgoing.get(current) ?? []) {
      depth.set(target, Math.max(depth.get(target) ?? 0, currentDepth + 1));
      indegree.set(target, (indegree.get(target) ?? 0) - 1);
      if ((indegree.get(target) ?? 0) === 0) queue.push(target);
    }
  }

  nodes.forEach((node) => {
    if (!depth.has(node.id)) depth.set(node.id, 0);
  });

  return depth;
};

const getLane = (nodeId: string, edgeKinds: Map<string, Set<'request' | 'data'>>): Lane => {
  if (nodeId === 'client' || nodeId === 'cdn' || nodeId === 'load-balancer' || nodeId === 'service') {
    return 'spine';
  }
  if (nodeId === 'cache' || nodeId === 'relational-db' || nodeId === 'nosql-db') {
    return 'serving';
  }
  if (nodeId === 'message-queue' || nodeId === 'batch-processor') {
    return 'background';
  }
  if (nodeId === 'worker' || nodeId === 'object-store') {
    return 'backgroundLow';
  }

  const kinds = edgeKinds.get(nodeId);
  return kinds?.has('data') ? 'background' : 'serving';
};

const buildPreferredPositions = (nodes: LayoutNode[], edges: LayoutEdge[]) => {
  const depths = computeDepths(nodes, edges);
  const edgeKinds = new Map<string, Set<'request' | 'data'>>();

  nodes.forEach((node) => edgeKinds.set(node.id, new Set()));
  edges.forEach((edge) => {
    edgeKinds.get(edge.source)?.add(edge.kind);
    edgeKinds.get(edge.target)?.add(edge.kind);
  });

  const grouped = new Map<Lane, LayoutNode[]>();
  (['spine', 'serving', 'background', 'backgroundLow'] as Lane[]).forEach((lane) => grouped.set(lane, []));

  nodes.forEach((node) => {
    grouped.get(getLane(node.id, edgeKinds))!.push(node);
  });

  const positions: Record<string, XYPosition> = {};

  for (const lane of ['spine', 'serving', 'background', 'backgroundLow'] as Lane[]) {
    const laneNodes = grouped.get(lane)!;
    laneNodes.sort((a, b) => {
      const ax = TYPE_X_RANK[a.id] ?? depths.get(a.id) ?? a.order;
      const bx = TYPE_X_RANK[b.id] ?? depths.get(b.id) ?? b.order;
      return ax - bx || a.order - b.order;
    });

    const xBuckets = new Map<number, LayoutNode[]>();
    laneNodes.forEach((node) => {
      const rank = Math.round((TYPE_X_RANK[node.id] ?? depths.get(node.id) ?? node.order) * 10) / 10;
      if (!xBuckets.has(rank)) xBuckets.set(rank, []);
      xBuckets.get(rank)!.push(node);
    });

    for (const [rank, bucket] of xBuckets.entries()) {
      const bucketHeight = bucket.reduce((sum, node) => sum + getNodeHeight(node), 0) + Math.max(0, bucket.length - 1) * 90;
      let currentY = LANE_Y[lane] - bucketHeight / 2;
      bucket
        .sort((a, b) => a.order - b.order)
        .forEach((node) => {
          const nodeHeight = getNodeHeight(node);
          positions[node.id] = {
            x: rank * X_SPACING,
            y: currentY + nodeHeight / 2 - DEFAULT_NODE_HEIGHT / 2,
          };
          currentY += nodeHeight + 90;
        });
    }
  }

  return positions;
};

export function layoutGraphNodes(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Record<string, XYPosition> {
  if (nodes.length === 0) return {};

  const nodeIds = new Set(nodes.map((node) => node.id));
  const validEdges = edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target,
  );

  const positions = buildPreferredPositions(nodes, validEdges);
  const preferred = Object.fromEntries(nodes.map((node) => [node.id, { ...positions[node.id] }]));
  const velocities = Object.fromEntries(nodes.map((node) => [node.id, { x: 0, y: 0 }]));

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const forces = Object.fromEntries(nodes.map((node) => [node.id, { x: 0, y: 0 }]));

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const delta = {
          x: positions[b.id].x - positions[a.id].x,
          y: positions[b.id].y - positions[a.id].y,
        };
        const distSq = delta.x * delta.x + delta.y * delta.y + 0.01;
        const dist = Math.sqrt(distSq);
        const unit = { x: delta.x / dist, y: delta.y / dist };
        const repel = REPULSION / distSq;

        forces[a.id].x -= unit.x * repel;
        forces[a.id].y -= unit.y * repel;
        forces[b.id].x += unit.x * repel;
        forces[b.id].y += unit.y * repel;

        const overlapX = getNodePadX(a) + getNodePadX(b) - Math.abs(delta.x);
        const overlapY = getNodePadY(a) + getNodePadY(b) - Math.abs(delta.y);
        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY) {
            const push = overlapX * COLLISION_PUSH * Math.sign(delta.x || 1);
            forces[a.id].x -= push;
            forces[b.id].x += push;
          } else {
            const push = overlapY * COLLISION_PUSH * Math.sign(delta.y || 1);
            forces[a.id].y -= push;
            forces[b.id].y += push;
          }
        }
      }
    }

    for (const edge of validEdges) {
      const source = positions[edge.source];
      const target = positions[edge.target];
      const delta = { x: target.x - source.x, y: target.y - source.y };
      const dist = Math.max(magnitude(delta), 1);
      const unit = normalize(delta);
      const stretch = dist - X_SPACING;

      forces[edge.source].x += unit.x * stretch * SPRING;
      forces[edge.source].y += unit.y * stretch * SPRING;
      forces[edge.target].x -= unit.x * stretch * SPRING;
      forces[edge.target].y -= unit.y * stretch * SPRING;
    }

    for (const edge of validEdges) {
      const start = positions[edge.source];
      const end = positions[edge.target];
      for (const node of nodes) {
        if (node.id === edge.source || node.id === edge.target) continue;

        const center = positions[node.id];
        const { distance, closest, t } = pointToSegmentDistance(center, start, end);
        if (t <= 0.08 || t >= 0.92) continue;

        const threshold = Math.max(getNodePadX(node), getNodePadY(node)) + 36;
        if (distance >= threshold) continue;

        let away = { x: center.x - closest.x, y: center.y - closest.y };
        if (magnitude(away) < 0.001) {
          const edgeDir = normalize({ x: end.x - start.x, y: end.y - start.y });
          away = { x: -edgeDir.y, y: edgeDir.x };
        }

        const push = (threshold - distance) * EDGE_NODE_PUSH;
        const unit = normalize(away);

        forces[node.id].x += unit.x * push;
        forces[node.id].y += unit.y * push;
        forces[edge.source].x -= unit.x * push * 0.16;
        forces[edge.source].y -= unit.y * push * 0.12;
        forces[edge.target].x -= unit.x * push * 0.16;
        forces[edge.target].y -= unit.y * push * 0.12;
      }
    }

    for (const node of nodes) {
      const target = preferred[node.id];
      forces[node.id].x += (target.x - positions[node.id].x) * X_ANCHOR;
      forces[node.id].y += (target.y - positions[node.id].y) * Y_ANCHOR;

      velocities[node.id].x = (velocities[node.id].x + forces[node.id].x) * DAMPING;
      velocities[node.id].y = (velocities[node.id].y + forces[node.id].y) * DAMPING;

      positions[node.id].x += clamp(velocities[node.id].x, -MAX_STEP, MAX_STEP);
      positions[node.id].y += clamp(velocities[node.id].y, -MAX_STEP, MAX_STEP);
    }
  }

  const values = Object.values(positions);
  const minX = Math.min(...values.map((position) => position.x));
  const maxX = Math.max(...values.map((position) => position.x));
  const minY = Math.min(...values.map((position) => position.y));
  const maxY = Math.max(...values.map((position) => position.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return Object.fromEntries(
    nodes.map((node) => [
      node.id,
      {
        x: Math.round((positions[node.id].x - centerX) * 10) / 10,
        y: Math.round((positions[node.id].y - centerY) * 10) / 10,
      },
    ]),
  );
}
