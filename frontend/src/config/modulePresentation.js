import {
  Cpu,
  Database,
  HardDrive,
  Network,
  ShieldCheck,
  Snowflake,
} from 'lucide-react';

export const MODULE_UI = {
  processor: {
    icon: Cpu,
    color: '#39a7db',
    position: [-1.15, 1.55, 0.12],
    size: [1.85, 0.58, 0.2],
  },
  memory: {
    icon: Database,
    color: '#32b36a',
    position: [1.15, 1.55, 0.12],
    size: [1.85, 0.58, 0.2],
  },
  storage: {
    icon: HardDrive,
    color: '#d99a2b',
    position: [-1.15, 0.62, 0.12],
    size: [1.85, 0.72, 0.2],
  },
  network: {
    icon: Network,
    color: '#8f6ee8',
    position: [1.15, 0.62, 0.12],
    size: [1.85, 0.72, 0.2],
  },
  security: {
    icon: ShieldCheck,
    color: '#d95c5c',
    position: [-1.15, -0.42, 0.12],
    size: [1.85, 0.82, 0.2],
  },
  power: {
    icon: Snowflake,
    color: '#25b5a3',
    position: [1.15, -0.42, 0.12],
    size: [1.85, 0.82, 0.2],
  },
};

export function mergeModulePresentation(apiModules) {
  return apiModules
    .map((module) => ({
      ...module,
      ...MODULE_UI[module.id],
    }))
    .filter((module) => module.icon);
}

export function isSelectionComplete(modules, selection) {
  return modules.length > 0 && modules.every((module) => selection[module.id] !== undefined);
}
