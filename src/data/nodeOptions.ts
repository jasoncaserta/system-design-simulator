import {
  Archive,
  Cog,
  Cpu,
  Database,
  DatabaseZap,
  Gauge,
  Globe,
  MonitorSmartphone,
  Router,
  ServerCog,
  Waypoints,
} from 'lucide-react';
import type { NodeType } from '../store/types';

export interface NodeOption {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  group: 'ingress' | 'serving' | 'data' | 'background';
}

export const NODE_OPTIONS: NodeOption[] = [
  { type: 'client', label: 'Clients', description: 'User devices / browsers', icon: MonitorSmartphone, color: 'bg-sky-500', group: 'ingress' },
  { type: 'cdn', label: 'Edge Cache', description: 'CDN / edge caching layer', icon: Globe, color: 'bg-sky-500', group: 'ingress' },
  { type: 'load-balancer', label: 'Load Balancer', description: 'Request routing / proxy', icon: Router, color: 'bg-sky-500', group: 'ingress' },
  { type: 'service', label: 'Service', description: 'Stateless API service', icon: ServerCog, color: 'bg-violet-500', group: 'serving' },
  { type: 'cache', label: 'Cache', description: 'In-memory serving cache', icon: Gauge, color: 'bg-violet-500', group: 'serving' },
  { type: 'relational-db', label: 'Relational DB', description: 'SQL database', icon: Database, color: 'bg-amber-500', group: 'data' },
  { type: 'nosql-db', label: 'NoSQL DB', description: 'Wide-column / document store', icon: DatabaseZap, color: 'bg-amber-500', group: 'data' },
  { type: 'message-queue', label: 'Message Queue', description: 'Async job scheduler', icon: Waypoints, color: 'bg-emerald-500', group: 'background' },
  { type: 'worker', label: 'Workers', description: 'Async background workers', icon: Cog, color: 'bg-emerald-500', group: 'background' },
  { type: 'object-store', label: 'Object Store', description: 'Blob / durable storage', icon: Archive, color: 'bg-emerald-500', group: 'background' },
  { type: 'batch-processor', label: 'Batch Processor', description: 'Offline batch / stream jobs', icon: Cpu, color: 'bg-emerald-500', group: 'background' },
];

export const NODE_OPTION_GROUPS: { key: NodeOption['group']; label: string }[] = [
  { key: 'ingress', label: 'Ingress' },
  { key: 'serving', label: 'Serving' },
  { key: 'data', label: 'Data' },
  { key: 'background', label: 'Background' },
];
