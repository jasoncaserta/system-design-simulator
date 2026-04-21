export const cadenceOptions = [
  { value: 'rare', label: 'Rare', description: 'Runs occasionally on loose freshness targets.' },
  { value: 'periodic', label: 'Periodic', description: 'Runs on a normal production refresh cadence.' },
  { value: 'frequent', label: 'Frequent', description: 'Runs often to keep derived state fresher.' },
  { value: 'continuous', label: 'Continuous', description: 'Runs aggressively with near-constant churn.' },
] as const;

export const jobCostOptions = [
  { value: 'light', label: 'Light', description: 'Mostly coordination and small fetch/update work.' },
  { value: 'medium', label: 'Medium', description: 'Balanced IO and compute per run.' },
  { value: 'heavy', label: 'Heavy', description: 'Larger fetches, transforms, and write phases.' },
  { value: 'very_heavy', label: 'Very Heavy', description: 'Expensive runs with substantial compute or IO.' },
] as const;

export const backfillOptions = [
  { value: 'off', label: 'Off', description: 'No historical catch-up beyond foreground freshness work.' },
  { value: 'catch_up', label: 'Catch-Up', description: 'Small amount of deferred historical work.' },
  { value: 'steady', label: 'Steady', description: 'Continuous background backfill at moderate pace.' },
  { value: 'aggressive', label: 'Aggressive', description: 'Heavy historical catch-up that competes for capacity.' },
] as const;

export const recoveryOptions = [
  { value: 'off', label: 'Off', description: 'Normal steady-state operation with no replay.' },
  { value: 'startup', label: 'Startup', description: 'Some replay as serving state warms or recovers.' },
  { value: 'rebuild', label: 'Rebuild', description: 'Large recovery or full serving-state replay.' },
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
    case 'lb': return 10000;
    case 'app': return 500;
    case 'cache': return 50000;
    case 'db': return 1000;
    case 'queue': return 400;
    case 'worker': return 80;
    case 'blob-storage': return 1500;
    case 'recompute': return 120;
    case 'bootstrap': return 180;
    case 'history': return 80;
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
