import React, { Suspense, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Html, OrbitControls } from '@react-three/drei';
import {
  Cpu,
  Database,
  HardDrive,
  Network,
  ShieldCheck,
  Snowflake,
  Zap,
  Server,
} from 'lucide-react';
import './styles.css';

const MODULES = [
  {
    id: 'processor',
    title: 'Processor Module',
    short: 'CPU',
    icon: Cpu,
    color: '#38bdf8',
    position: [-1.15, 1.55, 0.08],
    size: [1.85, 0.58, 0.18],
    options: [
      { name: 'Entry zCore 24', price: 420000, cpu: 24000, accelerator: 8, watts: 2.4, client: 'малка банка или университетски център' },
      { name: 'Enterprise zCore 64', price: 980000, cpu: 69000, accelerator: 24, watts: 5.8, client: 'застраховател, платежен оператор или ERP център' },
      { name: 'Mission Critical zCore 128', price: 1760000, cpu: 142000, accelerator: 52, watts: 10.6, client: 'национална банка, телекомуникационен оператор или държавна инфраструктура' },
    ],
  },
  {
    id: 'memory',
    title: 'Memory Module',
    short: 'RAM',
    icon: Database,
    color: '#22c55e',
    position: [1.15, 1.55, 0.08],
    size: [1.85, 0.58, 0.18],
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
    icon: HardDrive,
    color: '#f59e0b',
    position: [-1.15, 0.62, 0.08],
    size: [1.85, 0.72, 0.18],
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
    icon: Network,
    color: '#a855f7',
    position: [1.15, 0.62, 0.08],
    size: [1.85, 0.72, 0.18],
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
    icon: ShieldCheck,
    color: '#ef4444',
    position: [-1.15, -0.42, 0.08],
    size: [1.85, 0.82, 0.18],
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
    icon: Snowflake,
    color: '#14b8a6',
    position: [1.15, -0.42, 0.08],
    size: [1.85, 0.82, 0.18],
    options: [
      { name: 'Redundant air cooling', price: 90000, cooling: 1, watts: 0.7, efficiency: 1.18 },
      { name: 'N+1 precision cooling', price: 180000, cooling: 2, watts: 1.1, efficiency: 1.1 },
      { name: 'Liquid assisted cooling', price: 360000, cooling: 3, watts: 1.8, efficiency: 1.04 },
    ],
  },
];

const currency = new Intl.NumberFormat('bg-BG', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat('bg-BG');

function calculate(selection) {
  const chosen = MODULES.map((module) => module.options[selection[module.id] ?? 0]);
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

function MainframeModel({ activeModule, selection, setActiveModule }) {
  return (
    <group rotation={[0, -0.25, 0]}>
      <mesh position={[0, 0.52, -0.12]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 4.35, 1.08]} />
        <meshStandardMaterial color="#111827" roughness={0.72} metalness={0.45} />
      </mesh>
      <mesh position={[0, 0.52, 0.46]} castShadow>
        <boxGeometry args={[4.35, 4.05, 0.08]} />
        <meshStandardMaterial color="#243244" roughness={0.62} metalness={0.32} />
      </mesh>

      {MODULES.map((module) => {
        const selected = selection[module.id] ?? 0;
        const isActive = activeModule === module.id;
        return (
          <group key={module.id}>
            <mesh
              position={[module.position[0], module.position[1], isActive ? 0.67 : 0.59]}
              castShadow
              onClick={(event) => {
                event.stopPropagation();
                setActiveModule(module.id);
              }}
            >
              <boxGeometry args={module.size} />
              <meshStandardMaterial
                color={module.color}
                emissive={module.color}
                emissiveIntensity={isActive ? 0.34 : 0.09 + selected * 0.04}
                roughness={0.38}
                metalness={0.22}
              />
            </mesh>
            <Html
              center
              distanceFactor={8}
              position={[module.position[0], module.position[1], isActive ? 0.82 : 0.74]}
              className="module-label"
            >
              {module.short}
            </Html>
          </group>
        );
      })}

      <mesh position={[0, -1.82, 0.56]} castShadow>
        <boxGeometry args={[4.15, 0.38, 0.16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, 2.78, 0.03]} castShadow>
        <boxGeometry args={[4.8, 0.26, 1.22]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.5} />
      </mesh>
    </group>
  );
}

function Configurator() {
  const [selection, setSelection] = useState(() =>
    Object.fromEntries(MODULES.map((module) => [module.id, 1])),
  );
  const [activeModule, setActiveModule] = useState(MODULES[0].id);
  const totals = useMemo(() => calculate(selection), [selection]);

  const updateSelection = (moduleId, optionIndex) => {
    setSelection((current) => ({ ...current, [moduleId]: optionIndex }));
    setActiveModule(moduleId);
  };

  return (
    <main className="app-shell">
      <section className="stage">
        <div className="titlebar">
          <div>
            <span className="eyebrow">Дипломен проект</span>
            <h1>Mainframe 3D Configurator</h1>
          </div>
          <div className="status-pill">
            <Server size={18} />
            OpenGL/WebGL визуализация
          </div>
        </div>

        <div className="canvas-wrap">
          <Canvas camera={{ position: [4.7, 3.2, 6.3], fov: 42 }} shadows>
            <color attach="background" args={['#0b1020']} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[4, 5, 4]} intensity={1.8} castShadow />
            <Suspense fallback={null}>
              <MainframeModel
                activeModule={activeModule}
                selection={selection}
                setActiveModule={setActiveModule}
              />
              <ContactShadows position={[0, -2.05, 0]} opacity={0.45} scale={8} blur={2.5} />
              <Environment preset="city" />
            </Suspense>
            <OrbitControls enablePan={false} minDistance={5} maxDistance={9} />
          </Canvas>
        </div>
      </section>

      <aside className="panel">
        <div className="panel-head">
          <h2>Конфигурация</h2>
          <span>{MODULES.length} модула</span>
        </div>

        <div className="module-list">
          {MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <article
                className={`module-card ${activeModule === module.id ? 'active' : ''}`}
                key={module.id}
                style={{ '--accent': module.color }}
              >
                <button className="module-button" onClick={() => setActiveModule(module.id)}>
                  <Icon size={19} />
                  <span>{module.title}</span>
                </button>
                <select
                  value={selection[module.id]}
                  onChange={(event) => updateSelection(module.id, Number(event.target.value))}
                >
                  {module.options.map((option, index) => (
                    <option value={index} key={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </article>
            );
          })}
        </div>

        <div className="summary">
          <h2>Оценка</h2>
          <Metric label="Цена" value={currency.format(totals.total)} />
          <Metric label="CPU капацитет" value={`${number.format(totals.cpu)} MIPS`} />
          <Metric label="GPU/accelerator" value={`${number.format(totals.accelerator)} AI units`} />
          <Metric label="RAM" value={`${number.format(totals.ram)} GB`} />
          <Metric label="Storage" value={`${number.format(totals.storage)} TB`} />
          <Metric label="Електроенергия" value={`${totals.kw.toFixed(1)} kW`} icon={<Zap size={16} />} />
          <Metric label="Месечен разход" value={currency.format(totals.monthlyCost)} />
          <Metric label="Годишен разход" value={currency.format(totals.yearlyCost)} />
          <p className="recommendation">
            Подходяща конфигурация за: <strong>{totals.recommendation}</strong>.
          </p>
        </div>
      </aside>
    </main>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div className="metric">
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Configurator />);
