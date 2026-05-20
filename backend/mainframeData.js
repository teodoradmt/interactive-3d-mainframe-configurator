export const modules = [
  {
    id: 'processor',
    title: 'Processor Module',
    short: 'CPU',
    options: [
      {
        name: 'Entry zCore 24',
        price: 420000,
        cpu: 24000,
        accelerator: 8,
        watts: 2.4,
        client: 'малка банка или университетски център',
      },
      {
        name: 'Enterprise zCore 64',
        price: 980000,
        cpu: 69000,
        accelerator: 24,
        watts: 5.8,
        client: 'застраховател, платежен оператор или ERP център',
      },
      {
        name: 'Mission Critical zCore 128',
        price: 1760000,
        cpu: 142000,
        accelerator: 52,
        watts: 10.6,
        client: 'национална банка, телекомуникационен оператор или държавна инфраструктура',
      },
    ],
  },
  {
    id: 'memory',
    title: 'Memory Module',
    short: 'RAM',
    options: [
      { name: '1 TB ECC Memory', price: 160000, ram: 1024, watts: 0.9 },
      { name: '4 TB ECC Memory', price: 410000, ram: 4096, watts: 2.8 },
      { name: '12 TB ECC Memory', price: 930000, ram: 12288, watts: 6.5 },
    ],
  },
  {
    id: 'storage',
    title: 'Storage Module',
    short: 'Storage',
    options: [
      { name: '120 TB NVMe RAID', price: 210000, storage: 120, watts: 1.2 },
      { name: '640 TB Hybrid Tier', price: 520000, storage: 640, watts: 3.4 },
      { name: '2 PB Encrypted Flash', price: 1240000, storage: 2048, watts: 7.8 },
    ],
  },
  {
    id: 'network',
    title: 'I/O & Network Module',
    short: 'I/O',
    options: [
      { name: '40 GbE + 16 FC ports', price: 130000, io: 40, watts: 0.8 },
      { name: '100 GbE + 32 FC ports', price: 290000, io: 100, watts: 1.9 },
      { name: '400 GbE + low latency fabric', price: 680000, io: 400, watts: 4.2 },
    ],
  },
  {
    id: 'security',
    title: 'Security Module',
    short: 'Security',
    options: [
      { name: 'TPM + secure boot', price: 70000, security: 1, watts: 0.3 },
      { name: 'HSM crypto partition', price: 210000, security: 2, watts: 0.8 },
      { name: 'Quantum-safe crypto suite', price: 440000, security: 3, watts: 1.7 },
    ],
  },
  {
    id: 'power',
    title: 'Power & Cooling Module',
    short: 'Power',
    options: [
      { name: 'Redundant air cooling', price: 90000, cooling: 1, watts: 0.7, efficiency: 1.18 },
      { name: 'N+1 precision cooling', price: 180000, cooling: 2, watts: 1.1, efficiency: 1.1 },
      { name: 'Liquid assisted cooling', price: 360000, cooling: 3, watts: 1.8, efficiency: 1.04 },
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
