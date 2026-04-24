import type { Scenario } from '../store/types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'black-friday',
    name: 'Black Friday',
    description:
      'A flash sale just launched. Traffic spiked 10× in 60 seconds. The service is at 400% capacity and the on-call pager is going off.',
    goal: 'Scale the system so no node is overloaded at 10,000 users.',
    hint: 'Scale the service and load balancer first — they saturate before the database. Then check whether the cache hit rate is protecting the DB.',
    successCriteria: (nodes) =>
      nodes.length > 0 && nodes.every((n) => n.data.status !== 'overloaded'),
    initialState: {
      system: 'starter',
      params: { users: 10000 },
    },
  },
  {
    id: 'db-failure',
    name: 'Primary DB Fails',
    description:
      'The primary database went offline mid-peak. Service threads are blocking on timed-out queries and the service itself is now overloaded from the back-pressure.',
    goal: 'Get the service back below 100% utilization while the DB is still down.',
    hint: 'Scale the service horizontally to absorb the orphaned-query pressure. Or increase cache hit rate so fewer reads ever reach the DB layer.',
    successCriteria: (nodes) => {
      const service = nodes.find((n) => n.id === 'service');
      return !!service && service.data.status !== 'overloaded';
    },
    initialState: {
      system: 'starter',
      // 2,000 users → 200 QPS. Service normally sits at ~76%. DB failure adds ~75 QPS of
      // orphaned load back to service → ~265 QPS against 250 capacity = overloaded.
      params: { users: 2000 },
      nodeHealth: { 'relational-db': 'unavailable' },
    },
  },
  {
    id: 'cache-cold-start',
    name: 'Cache Cold Start',
    description:
      'Fresh cache instances just came up after a rolling restart. The cache is completely empty and every read is a miss. The database is overloaded.',
    goal: 'Prevent the relational DB from being overloaded before the cache warms up.',
    hint: 'Increase cache working set fit and hit rate to represent a warmer cache. Or add DB read replicas (more followers) to spread the read load.',
    successCriteria: (nodes) => {
      const db = nodes.find((n) => n.id === 'relational-db');
      return !!db && db.data.status !== 'overloaded';
    },
    initialState: {
      system: 'starter',
      // DB capacity set to 50 ops/sec (a small, slow DB) so that at 0% cache hit rate
      // ~54 QPS of misses easily overwhelm it. At 80% hit rate only ~25 QPS reach it → healthy.
      params: { cacheHitRate: 0, cacheWorkingSetFit: 0.01 },
      nodeCapacities: { 'relational-db': 50 },
    },
  },
  {
    id: 'queue-backup',
    name: 'Queue Backup',
    description:
      'Upstream data sources are publishing faster than workers can consume. The queue is full, retries are amplifying the load, and both the broker and workers are overloaded.',
    goal: 'Get the message queue and workers back to a healthy state.',
    hint: 'Scale worker instances to drain the queue faster. Lower source job count or retry rate to reduce input pressure. The API priority gate can protect serving reads.',
    successCriteria: (nodes) => {
      const queue = nodes.find((n) => n.id === 'message-queue');
      const worker = nodes.find((n) => n.id === 'worker');
      return (
        !!queue && queue.data.status !== 'overloaded' &&
        !!worker && worker.data.status !== 'overloaded'
      );
    },
    initialState: {
      system: 'pickgpu',
      // 12 source types + full queue depth + high retries → scheduler ~42 ops/sec against
      // 40 capacity (overloaded) and worker ~32 against 25 capacity (overloaded).
      params: { sourceJobTypes: 12, queueDepth: 1.0, retryRate: 0.25 },
    },
  },
  {
    id: 'hot-shard',
    name: 'Hot Shard',
    description:
      'Your data lives on a single database shard and write load is high. All writes bottleneck on one node. The DB is overloaded.',
    goal: 'Eliminate the DB write bottleneck using sharding.',
    hint: 'Open the relational DB config and increase the shard count. Watch how capacity scales linearly with shards.',
    successCriteria: (nodes) => {
      const db = nodes.find((n) => n.id === 'relational-db');
      return !!db && db.data.status !== 'overloaded' && db.data.status !== 'stressed';
    },
    initialState: {
      system: 'starter',
      // DB capacity 200 ops/sec, single shard. 3,000 users → 300 QPS,
      // 70% writes = 210 QPS against 200 capacity = overloaded.
      // Fix: add shards. 3 shards → 600 capacity → healthy.
      params: {
        users: 3000,
        databaseShardCount: 1,
        databaseWriteLoad: 0.85,
        readWriteRatio: 0.3,
      },
      nodeCapacities: { 'relational-db': 200 },
    },
  },
  {
    id: 'cascade-failure',
    name: 'Cascade Failure',
    description:
      'The serving cache is offline and the service is running degraded at 40% capacity. Every read that hits the dead cache blocks a service thread. The stack is on fire.',
    goal: 'Restore the system to fully healthy — bring both components back online.',
    hint: 'Click "Up" on the degraded service and offline cache to restore them, then observe how health cascades back through the system.',
    successCriteria: (nodes) =>
      nodes.length > 0 &&
      nodes.every(
        (n) =>
          n.data.healthState !== 'unavailable' &&
          n.data.healthState !== 'degraded' &&
          n.data.status === 'healthy',
      ),
    initialState: {
      system: 'starter',
      // 2,000 users. Service degraded (40% capacity = 100 ops/sec) receives 190 QPS normally +
      // ~244 QPS orphaned from the unavailable cache → 434 QPS against 100 = massively overloaded.
      params: { users: 2000 },
      nodeHealth: { cache: 'unavailable', service: 'degraded' },
    },
  },
];
