export const modules = [
  {
    id: 'processor',
    title: 'IBM Z Generation',
    short: 'CPU',
    options: [
      {
        name: 'IBM z15 8561',
        spec: 'z15 CP, 12-core 5.2 GHz, RAIM',
        price: 420000,
        cpu: 85000,
        accelerator: 6,
        watts: 2.4,
        client: 'малка банка, университетски център или Linux on IBM Z среда',
      },
      {
        name: 'IBM z16 Telum',
        spec: 'Telum, on-chip AI, quantum-safe',
        price: 980000,
        cpu: 125000,
        accelerator: 24,
        watts: 5.8,
        client: 'застраховател, платежен оператор или ERP център с fraud detection',
      },
      {
        name: 'IBM z17 Telum II',
        spec: 'Telum II, DPU, Spyre-ready AI',
        price: 1760000,
        cpu: 175000,
        accelerator: 48,
        watts: 10.6,
        client: 'национална банка, телекомуникационен оператор или AI-ready държавна инфраструктура',
      },
    ],
  },
  {
    id: 'memory',
    title: 'IBM Z Memory',
    short: 'RAM',
    options: [
      { name: 'RAIM 1 TB', spec: 'Entry RAIM memory', price: 160000, ram: 1024, watts: 0.9 },
      { name: 'RAIM 4 TB', spec: 'Production LPAR consolidation', price: 410000, ram: 4096, watts: 2.8 },
      { name: 'RAIM 12 TB', spec: 'Large in-memory workloads', price: 930000, ram: 12288, watts: 6.5 },
    ],
  },
  {
    id: 'storage',
    title: 'IBM Z Storage',
    short: 'Storage',
    options: [
      { name: 'DS8900F 120 TB', spec: 'FICON attached flash tier', price: 210000, storage: 120, watts: 1.2 },
      { name: 'DS8900F 640 TB', spec: 'zHyperLink low-latency tier', price: 520000, storage: 640, watts: 3.4 },
      { name: 'Cyber Vault 2 PB', spec: 'Resilient copy / recovery tier', price: 1240000, storage: 2048, watts: 7.8 },
    ],
  },
  {
    id: 'network',
    title: 'IBM Z I/O & Network',
    short: 'I/O',
    options: [
      { name: 'OSA-Express + FICON Base', spec: '40 GbE class + 16 FC', price: 130000, io: 40, watts: 0.8 },
      { name: 'OSA-Express + RoCE', spec: '100 GbE class + 32 FC', price: 290000, io: 100, watts: 1.9 },
      { name: 'High-throughput I/O Fabric', spec: '400 GbE class + zHyperLink', price: 680000, io: 400, watts: 4.2 },
    ],
  },
  {
    id: 'security',
    title: 'IBM Z Security',
    short: 'Security',
    options: [
      { name: 'CPACF + Crypto Express', spec: 'Pervasive encryption base', price: 70000, security: 1, watts: 0.3 },
      { name: 'z16 Quantum-safe Suite', spec: 'Quantum-safe firmware path', price: 210000, security: 2, watts: 0.8 },
      { name: 'z17 AI Security Suite', spec: 'Quantum-safe + AI detection', price: 440000, security: 3, watts: 1.7 },
    ],
  },
  {
    id: 'power',
    title: 'IBM Z Power & Cooling',
    short: 'Power',
    options: [
      { name: 'Air-cooled Frame', spec: 'Standard redundant cooling', price: 90000, cooling: 1, watts: 0.7, efficiency: 1.18 },
      { name: 'Rear Door Heat Exchanger', spec: 'Datacenter chilled-water assist', price: 180000, cooling: 2, watts: 1.1, efficiency: 1.1 },
      { name: 'Liquid-cooling Ready', spec: 'High-density z17-ready cooling', price: 360000, cooling: 3, watts: 1.8, efficiency: 1.04 },
    ],
  },
];

function normalizeOptionIndex(module, value) {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed >= 0 && parsed < module.options.length) {
    return parsed;
  }

  return Math.min(1, module.options.length - 1);
}

export function calculateEstimate(selection = {}) {
  const chosen = modules.map((module) => {
    const optionIndex = normalizeOptionIndex(module, selection[module.id]);
    return module.options[optionIndex];
  });
  const baseWatts = chosen.reduce((sum, item) => sum + item.watts, 0);
  const cooling = chosen.find((item) => item.efficiency);
  const kw = baseWatts * (cooling?.efficiency ?? 1.14);
  const monthlyEnergy = kw * 24 * 30;
  const yearlyEnergy = kw * 24 * 365;
  const energyPrice = 0.23;
  const cpu = chosen.reduce((sum, item) => sum + (item.cpu ?? 0), 0);
  const accelerator = chosen.reduce((sum, item) => sum + (item.accelerator ?? 0), 0);
  const ram = chosen.reduce((sum, item) => sum + (item.ram ?? 0), 0);
  const storage = chosen.reduce((sum, item) => sum + (item.storage ?? 0), 0);
  const total = chosen.reduce((sum, item) => sum + item.price, 0);
  const recommendation = chosen.find((item) => item.client)?.client ?? 'корпоративен клиент';

  return {
    total,
    cpu,
    accelerator,
    ram,
    storage,
    kw,
    monthlyEnergy,
    yearlyEnergy,
    monthlyCost: monthlyEnergy * energyPrice,
    yearlyCost: yearlyEnergy * energyPrice,
    recommendation,
  };
}
