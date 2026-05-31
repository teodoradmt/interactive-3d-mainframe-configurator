import {
  Archive,
  BatteryCharging,
  Cable,
  Cpu,
  Database,
  HardDrive,
  MonitorCog,
  ShieldCheck,
  ShieldAlert,
  ThermometerSnowflake,
} from 'lucide-react';

export const MODULE_UI = {
  processor: {
    icon: Cpu,
    color: '#39a7db',
    position: [0, 1.74, 0.18],
    size: [2.55, 0.36, 0.2],
  },
  memory: {
    icon: Database,
    color: '#32b36a',
    position: [0, 1.2, 0.18],
    size: [2.55, 0.36, 0.2],
  },
  storage: {
    icon: Cable,
    color: '#d99a2b',
    position: [0, 0.66, 0.18],
    size: [2.55, 0.36, 0.2],
  },
  network: {
    icon: MonitorCog,
    color: '#8f6ee8',
    position: [0, 0.12, 0.18],
    size: [2.55, 0.36, 0.2],
  },
  security: {
    icon: ShieldCheck,
    color: '#d95c5c',
    position: [0, -0.42, 0.18],
    size: [2.55, 0.36, 0.2],
  },
  power: {
    icon: BatteryCharging,
    color: '#25b5a3',
    position: [0, -0.96, 0.18],
    size: [2.55, 0.36, 0.2],
  },
  cooling: {
    icon: ThermometerSnowflake,
    color: '#62c7ea',
    position: [0, -1.5, 0.18],
    size: [2.55, 0.36, 0.2],
  },
  externalDASD: {
    icon: HardDrive,
    color: '#f5c15c',
  },
  tapeBackup: {
    icon: Archive,
    color: '#b7c0c7',
  },
  cyberVault: {
    icon: ShieldAlert,
    color: '#7d8df1',
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
  const requiredModules = modules.filter((module) => module.required !== false && module.category !== 'external');

  return requiredModules.length > 0 && requiredModules.every((module) => selection[module.id] !== undefined);
}
