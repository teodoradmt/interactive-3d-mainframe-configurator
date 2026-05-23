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
    position: [0, 1.72, 0.18],
    size: [2.55, 0.46, 0.2],
  },
  memory: {
    icon: Database,
    color: '#32b36a',
    position: [0, 1.08, 0.18],
    size: [2.55, 0.46, 0.2],
  },
  storage: {
    icon: HardDrive,
    color: '#d99a2b',
    position: [0, 0.44, 0.18],
    size: [2.55, 0.46, 0.2],
  },
  network: {
    icon: Network,
    color: '#8f6ee8',
    position: [0, -0.2, 0.18],
    size: [2.55, 0.46, 0.2],
  },
  security: {
    icon: ShieldCheck,
    color: '#d95c5c',
    position: [0, -0.84, 0.18],
    size: [2.55, 0.46, 0.2],
  },
  power: {
    icon: Snowflake,
    color: '#25b5a3',
    position: [0, -1.48, 0.18],
    size: [2.55, 0.46, 0.2],
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
