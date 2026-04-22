export const cadenceOptions = [
  { value: 'rare', label: 'Low', description: 'Loose freshness targets with infrequent scheduling.' },
  { value: 'periodic', label: 'Medium', description: 'Typical production dispatch or refresh rate.' },
  { value: 'frequent', label: 'High', description: 'Aggressive scheduling to reduce staleness.' },
  { value: 'continuous', label: 'Hot', description: 'Near-continuous work with heavy coordination pressure.' },
] as const;

export const jobCostOptions = [
  { value: 'light', label: 'Light', description: 'Small fetch, transform, and write cost per task.' },
  { value: 'medium', label: 'Medium', description: 'Balanced IO and compute per task.' },
  { value: 'heavy', label: 'Heavy', description: 'Expensive fetch or transform work per task.' },
  { value: 'very_heavy', label: 'Very Heavy', description: 'High compute or IO intensity per task.' },
] as const;

export const backfillOptions = [
  { value: 'off', label: 'Off', description: 'No historical replay beyond current freshness work.' },
  { value: 'catch_up', label: 'Catch-Up', description: 'Light deferred historical processing.' },
  { value: 'steady', label: 'Steady', description: 'Continuous moderate backfill pressure.' },
  { value: 'aggressive', label: 'Aggressive', description: 'Heavy backfill that competes with foreground capacity.' },
] as const;

export const recoveryOptions = [
  { value: 'off', label: 'Off', description: 'No recovery replay pressure.' },
  { value: 'startup', label: 'Startup', description: 'Moderate replay while warming serving state.' },
  { value: 'rebuild', label: 'Rebuild', description: 'Large replay or full serving-state rebuild.' },
] as const;

export const processingModeOptions = [
  { value: 'batch', label: 'Batch', description: 'Windowed work with more burstiness and scan-heavy processing.' },
  { value: 'stream', label: 'Stream', description: 'Steadier low-latency processing with more coordination overhead.' },
] as const;

export const replicationModeOptions = [
  { value: 'single_leader', label: 'Single Leader', description: 'Writes stay on one primary with limited read offload.' },
  { value: 'leader_follower', label: 'Leader/Follower', description: 'One leader handles writes while followers absorb reads.' },
] as const;

export const sizes = [
  { label: 'small', mult: 0.5 },
  { label: 'medium', mult: 1.0 },
  { label: 'large', mult: 2.0 },
  { label: 'xlarge', mult: 4.0 },
] as const;

export const stepThroughOptions = <T extends string>(
  options: readonly { value: T }[],
  current: T,
  delta: number,
) => {
  const currentIndex = options.findIndex((option) => option.value === current);
  const nextIndex = Math.max(0, Math.min(options.length - 1, currentIndex + delta));
  return options[nextIndex].value;
};

export const getBaseCapacity = (type: string) => {
  switch (type) {
    case 'cdn': return 100000;
    case 'load-balancer': return 10000;
    case 'service': return 500;
    case 'cache': return 50000;
    case 'relational-db': return 900;
    case 'nosql-db': return 1400;
    case 'message-queue': return 400;
    case 'worker': return 80;
    case 'object-store': return 1500;
    case 'batch-processor': return 200;
    default: return 1000;
  }
};

export const getInstanceSize = (capacity: number, baseCapacity: number) => {
  const ratio = capacity / baseCapacity;
  if (ratio <= 0.51) return 'small';
  if (ratio <= 1.01) return 'medium';
  if (ratio <= 2.01) return 'large';
  return 'xlarge';
};
