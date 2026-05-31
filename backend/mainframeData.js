export const modules = [
  {
    id: 'processor',
    category: 'cpc',
    required: true,
    title: 'CPC / Processor Complex',
    short: 'CPC Drawer',
    options: [
      {
        name: 'Entry Processor Complex',
        spec: 'Entry CPC drawer for moderate consolidation and Linux workloads',
        price: 420000,
        cpu: 85000,
        accelerator: 8,
        capacityScore: 42,
        aiScore: 12,
        lpars: 30,
        watts: 2.4,
      },
      {
        name: 'Enterprise Processor Complex',
        spec: 'Enterprise CPC drawer for high transaction density and mixed workloads',
        price: 980000,
        cpu: 125000,
        accelerator: 26,
        capacityScore: 72,
        aiScore: 38,
        lpars: 70,
        watts: 5.8,
      },
      {
        name: 'AI-Accelerated CPC',
        spec: 'AI-accelerated CPC drawer with maximum demo capacity and accelerator score',
        price: 1760000,
        cpu: 175000,
        accelerator: 54,
        capacityScore: 96,
        aiScore: 78,
        lpars: 120,
        watts: 10.6,
      },
    ],
  },
  {
    id: 'memory',
    category: 'cpc',
    required: true,
    title: 'Memory & Virtualization',
    short: 'Memory / LPAR',
    options: [
      {
        name: '1 TB RAIM Memory',
        spec: 'Entry RAIM memory with base LPAR capacity',
        price: 160000,
        ram: 1024,
        lpars: 20,
        consolidationScore: 30,
        watts: 0.9,
      },
      {
        name: '4 TB RAIM Memory',
        spec: 'Production RAIM memory for LPAR consolidation',
        price: 410000,
        ram: 4096,
        lpars: 60,
        consolidationScore: 62,
        watts: 2.8,
      },
      {
        name: '12 TB RAIM Memory',
        spec: 'Large RAIM memory tier for dense in-memory workloads',
        price: 930000,
        ram: 12288,
        lpars: 120,
        consolidationScore: 95,
        watts: 6.5,
      },
    ],
  },
  {
    id: 'storage',
    category: 'cpc',
    required: true,
    title: 'I/O Connectivity Drawers',
    short: 'I/O Drawers',
    options: [
      {
        name: 'Basic OSA Network',
        spec: 'Base OSA network connectivity without dedicated external DASD fabric',
        price: 130000,
        io: 40,
        externalDASDSupport: false,
        tapeConnectivity: false,
        watts: 0.8,
      },
      {
        name: 'FICON + Fibre Channel',
        spec: 'FICON/SAN links for external DASD and tape connectivity',
        price: 290000,
        io: 140,
        externalDASDSupport: true,
        tapeConnectivity: true,
        watts: 1.9,
      },
      {
        name: 'Enterprise I/O Fabric',
        spec: 'High-bandwidth I/O fabric for large external storage topologies',
        price: 680000,
        io: 400,
        externalDASDSupport: true,
        tapeConnectivity: true,
        watts: 4.2,
      },
    ],
  },
  {
    id: 'network',
    category: 'cpc',
    required: true,
    title: 'Management & Control',
    short: 'Management / SE',
    options: [
      {
        name: 'Basic Management',
        spec: 'Base HMC and support element management',
        price: 85000,
        management: 35,
        redundancy: 1,
        monitoring: 25,
        watts: 0.4,
      },
      {
        name: 'Redundant Support Elements',
        spec: 'Redundant SE/HMC control path for production operations',
        price: 190000,
        management: 65,
        redundancy: 2,
        monitoring: 55,
        watts: 0.9,
      },
      {
        name: 'Advanced Monitoring & Control',
        spec: 'Advanced monitoring, control hubs, and operations telemetry',
        price: 360000,
        management: 92,
        redundancy: 3,
        monitoring: 90,
        watts: 1.4,
      },
    ],
  },
  {
    id: 'security',
    category: 'cpc',
    required: true,
    title: 'Crypto & Security',
    short: 'Crypto / Security',
    options: [
      {
        name: 'Standard Secure Boot',
        spec: 'Secure boot and base platform protection',
        price: 70000,
        security: 1,
        compliance: 30,
        watts: 0.3,
      },
      {
        name: 'Crypto Express',
        spec: 'Hardware crypto acceleration and pervasive encryption support',
        price: 210000,
        security: 2,
        compliance: 68,
        watts: 0.8,
      },
      {
        name: 'Quantum-Safe Security Suite',
        spec: 'Quantum-safe security posture with AI-assisted protection score',
        price: 440000,
        security: 3,
        compliance: 95,
        accelerator: 6,
        watts: 1.7,
      },
    ],
  },
  {
    id: 'power',
    category: 'cpc',
    required: true,
    title: 'Power Infrastructure',
    short: 'Power',
    options: [
      {
        name: 'Standard Redundant Power',
        spec: 'Standard redundant power feeds for CPC frame operation',
        price: 90000,
        uptimeScore: 45,
        shutdownProtection: 35,
        watts: 0.7,
      },
      {
        name: 'Internal Battery Feature',
        spec: 'Internal battery feature for controlled shutdown protection',
        price: 180000,
        uptimeScore: 68,
        shutdownProtection: 72,
        watts: 1.1,
      },
      {
        name: 'High-Availability Power',
        spec: 'High-availability internal power design for critical environments',
        price: 330000,
        uptimeScore: 92,
        shutdownProtection: 95,
        watts: 1.7,
      },
    ],
  },
  {
    id: 'cooling',
    category: 'cpc',
    required: true,
    title: 'Cooling Infrastructure',
    short: 'Cooling',
    options: [
      {
        name: 'Air-Cooled Frame',
        spec: 'Standard air-cooled CPC frame',
        price: 90000,
        cooling: 1,
        thermalScore: 38,
        performanceCeiling: 52,
        watts: 0.7,
        efficiency: 1.18,
      },
      {
        name: 'Rear Door Heat Exchanger',
        spec: 'Rear door heat exchanger for higher-density datacenter cooling',
        price: 180000,
        cooling: 2,
        thermalScore: 70,
        performanceCeiling: 78,
        watts: 1.1,
        efficiency: 1.1,
      },
      {
        name: 'Liquid-Cooling Ready',
        spec: 'Liquid-cooling-ready frame for maximum performance support',
        price: 360000,
        cooling: 3,
        thermalScore: 94,
        performanceCeiling: 96,
        watts: 1.8,
        efficiency: 1.04,
      },
    ],
  },
  {
    id: 'externalDASD',
    category: 'external',
    required: false,
    title: 'External DASD Storage',
    short: 'DASD',
    externalObject: 'dasd',
    options: [
      {
        name: 'DASD Array 120 TB',
        spec: 'FICON / SAN attached external DASD array',
        price: 210000,
        storage: 120,
        watts: 1.2,
      },
      {
        name: 'Flash Enterprise Storage 640 TB',
        spec: 'High-performance external flash storage cabinet',
        price: 520000,
        storage: 640,
        watts: 3.4,
      },
      {
        name: '2 PB Enterprise DASD',
        spec: 'Large external DASD cabinet for enterprise data estates',
        price: 1240000,
        storage: 2048,
        watts: 7.8,
      },
    ],
  },
  {
    id: 'tapeBackup',
    category: 'external',
    required: false,
    title: 'Tape Library',
    short: 'Tape',
    externalObject: 'tape',
    options: [
      {
        name: 'Entry Tape Library',
        spec: 'External tape backup for small retention sets',
        price: 120000,
        backupCapacity: 250,
        watts: 0.8,
      },
      {
        name: 'Enterprise Tape Library',
        spec: 'External tape backup with automated media handling',
        price: 310000,
        backupCapacity: 900,
        watts: 1.8,
      },
      {
        name: 'Air-Gapped Tape Library',
        spec: 'Air-gapped tape tier for resilient backup workflows',
        price: 620000,
        backupCapacity: 1800,
        watts: 3.2,
      },
    ],
  },
  {
    id: 'cyberVault',
    category: 'external',
    required: false,
    title: 'Cyber Vault',
    short: 'Cyber Vault',
    externalObject: 'vault',
    options: [
      {
        name: 'DR Replication Target',
        spec: 'External recovery target for replicated critical volumes',
        price: 260000,
        recoveryScore: 45,
        watts: 1.1,
      },
      {
        name: 'Cyber Vault Appliance',
        spec: 'Isolated recovery copy tier for cyber resilience',
        price: 640000,
        recoveryScore: 72,
        watts: 2.8,
      },
      {
        name: 'Immutable Cyber Vault',
        spec: 'Advanced immutable vault with rapid validation workflows',
        price: 1180000,
        recoveryScore: 94,
        watts: 5.1,
      },
    ],
  },
];

function isOptionalModule(module) {
  return module.required === false || module.category === 'external';
}

function normalizeOptionIndex(module, value) {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed >= 0 && parsed < module.options.length) {
    return parsed;
  }

  return Math.min(1, module.options.length - 1);
}

function getChosenOptions(selection, availableModules) {
  return availableModules.flatMap((module) => {
    if (isOptionalModule(module) && selection[module.id] === undefined) {
      return [];
    }

    const optionIndex = normalizeOptionIndex(module, selection[module.id]);
    return [module.options[optionIndex]];
  });
}

export function calculateEstimate(selection = {}, availableModules = modules) {
  const chosen = getChosenOptions(selection, availableModules);
  const baseWatts = chosen.reduce((sum, item) => sum + item.watts, 0);
  const cooling = chosen.find((item) => item.efficiency);
  const kw = baseWatts * (cooling?.efficiency ?? 1.14);
  const monthlyEnergy = kw * 24 * 30;
  const yearlyEnergy = kw * 24 * 365;
  const energyPrice = 0.23;
  const cpu = chosen.reduce((sum, item) => sum + (item.cpu ?? 0), 0);
  const accelerator = chosen.reduce((sum, item) => sum + (item.accelerator ?? item.aiScore ?? 0), 0);
  const ram = chosen.reduce((sum, item) => sum + (item.ram ?? 0), 0);
  const storage = chosen.reduce((sum, item) => sum + (item.storage ?? 0), 0);
  const lpars = chosen.reduce((sum, item) => sum + (item.lpars ?? 0), 0);
  const io = chosen.reduce((sum, item) => sum + (item.io ?? 0), 0);
  const security = chosen.reduce((sum, item) => sum + (item.security ?? 0), 0);
  const total = chosen.reduce((sum, item) => sum + item.price, 0);

  return {
    total,
    cpu,
    accelerator,
    ram,
    storage,
    lpars,
    io,
    security,
    kw,
    monthlyEnergy,
    yearlyEnergy,
    monthlyCost: monthlyEnergy * energyPrice,
    yearlyCost: yearlyEnergy * energyPrice,
  };
}
