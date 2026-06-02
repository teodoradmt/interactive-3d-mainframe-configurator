import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Html, OrbitControls, useGLTF } from '@react-three/drei';
import { MathUtils, Vector3 } from 'three';
import { blenderAssets } from '../config/blenderAssets.js';
import { defaultMainframeDesign } from '../config/mainframeDesigns.js';

const LABEL_FRONT_VIEW_THRESHOLD = 0.52;
const DOOR_CLOSED_ANGLE = 0;
const DOOR_OPEN_ANGLE = -1.12;
const MODULE_COVER_DELAY_MS = 1050;
const DEFAULT_SCENE_BACKGROUND = {
  type: 'color',
  color: '#101113',
  imageUrl: '',
};
const EXTERNAL_SYSTEM_LAYOUT = {
  externalDASD: {
    offset: [3.55, -0.92, 1.08],
    scale: 0.68,
  },
  tapeBackup: {
    offset: [5.05, -0.64, -0.72],
    scale: 0.72,
  },
  cyberVault: {
    offset: [3.62, -0.98, -2.32],
    scale: 0.66,
  },
};
const A_FRAME_MODULE_DEFINITIONS = [
  {
    id: 'a-frame-pcie-io',
    sourceModuleId: 'storage',
    short: 'PCIe I/O',
    color: '#d99a2b',
    position: [0, 1.58, 0.18],
    size: [2.55, 0.42, 0.2],
  },
  {
    id: 'a-frame-cooling',
    sourceModuleId: 'cooling',
    short: 'Cooling',
    color: '#62c7ea',
    position: [0, 0.92, 0.18],
    size: [2.55, 0.44, 0.2],
  },
  {
    id: 'a-frame-power',
    sourceModuleId: 'power',
    short: 'Power',
    color: '#25b5a3',
    position: [0, 0.22, 0.18],
    size: [2.55, 0.44, 0.2],
  },
  {
    id: 'a-frame-interconnect',
    sourceModuleId: 'storage',
    short: 'Interconnect',
    color: '#8dd7f7',
    position: [0, -0.5, 0.18],
    size: [2.55, 0.42, 0.2],
  },
  {
    id: 'a-frame-expansion',
    sourceModuleId: 'processor',
    short: 'Expansion',
    color: '#8f6ee8',
    position: [0, -1.22, 0.18],
    size: [2.55, 0.5, 0.2],
  },
];

function isExternalModule(module) {
  return module.required === false || module.category === 'external';
}

function getSelectedIndex(selection, moduleId) {
  const selectedIndex = Number(selection[moduleId]);

  return Number.isInteger(selectedIndex) ? selectedIndex : undefined;
}

function isSelected(selection, moduleId, minimumIndex = 0) {
  const selectedIndex = getSelectedIndex(selection, moduleId);

  return selectedIndex !== undefined && selectedIndex >= minimumIndex;
}

function buildAFrameModules(selection, selectedExternalModules, sourceModules) {
  const hasExternalSystems = selectedExternalModules.length > 0;
  const hasCyberVault = isSelected(selection, 'cyberVault');
  const hasTapeLibrary = isSelected(selection, 'tapeBackup');
  const hasEnterpriseIo = isSelected(selection, 'storage', 2);
  const hasHighEndCpc = isSelected(selection, 'processor', 2) || isSelected(selection, 'memory', 2);
  const sourceModulesById = new Map(sourceModules.map((module) => [module.id, module]));

  const activeByModuleId = {
    'a-frame-pcie-io': hasEnterpriseIo || hasExternalSystems,
    'a-frame-cooling': isSelected(selection, 'cooling', 2) || hasHighEndCpc,
    'a-frame-power': isSelected(selection, 'power', 2) || hasHighEndCpc,
    'a-frame-interconnect': hasEnterpriseIo || hasExternalSystems || hasTapeLibrary || hasCyberVault,
    'a-frame-expansion': hasHighEndCpc || hasCyberVault || selectedExternalModules.length > 1,
  };

  return A_FRAME_MODULE_DEFINITIONS.map((module) => ({
    ...module,
    isConfigured: Boolean(activeByModuleId[module.id]),
    selectedOptionName: sourceModulesById.get(module.sourceModuleId)?.options?.[getSelectedIndex(selection, module.sourceModuleId)]?.name,
  }));
}

function getCanvasBackgroundStyle(background, fallbackColor) {
  if (background?.type === 'image' && background.imageUrl) {
    return {
      backgroundColor: background.color ?? fallbackColor,
      backgroundImage: `url("${background.imageUrl}")`,
    };
  }

  return {
    backgroundColor: background?.color ?? fallbackColor,
  };
}

function ImportedGlbObject({ asset }) {
  const { scene } = useGLTF(asset.path);
  const model = useMemo(() => scene.clone(true), [scene]);

  return (
    <primitive
      object={model}
      position={asset.position ?? [0, 0, 0]}
      rotation={asset.rotation ?? [0, 0, 0]}
      scale={asset.scale ?? 1}
    />
  );
}

function BlenderAssetSlots() {
  return blenderAssets.map((asset) => <ImportedGlbObject asset={asset} key={asset.id} />);
}

function RackRail({ colors, x }) {
  return (
    <group position={[x, 0.22, 0.72]}>
      <mesh castShadow>
        <boxGeometry args={[0.075, 4.62, 0.085]} />
        <meshStandardMaterial color={colors.rail} roughness={0.42} metalness={0.78} />
      </mesh>
      {Array.from({ length: 19 }).map((_, index) => (
        <mesh key={index} position={[0, 2.1 - index * 0.23, 0.064]} castShadow>
          <boxGeometry args={[0.1, 0.032, 0.028]} />
          <meshStandardMaterial color={colors.railNotch} roughness={0.3} metalness={0.82} />
        </mesh>
      ))}
    </group>
  );
}

function SideVentPattern({ colors }) {
  return (
    <group position={[1.68, 0.1, -0.05]} rotation={[0, Math.PI / 2, 0]}>
      {Array.from({ length: 12 }).map((_, index) => (
        <mesh key={index} position={[-0.12 + (index % 3) * 0.16, -1.75 + Math.floor(index / 3) * 0.52, 0.02]} castShadow>
          <boxGeometry args={[0.055, 0.38, 0.035]} />
          <meshStandardMaterial color={colors.sideVent} roughness={0.62} metalness={0.44} />
        </mesh>
      ))}
      <mesh position={[0.12, 0.18, 0.025]} rotation={[0, 0, -0.55]} castShadow>
        <boxGeometry args={[0.075, 1.6, 0.04]} />
        <meshStandardMaterial color={colors.sideVent} roughness={0.62} metalness={0.44} />
      </mesh>
    </group>
  );
}

function RackSlotStack({ colors, modules }) {
  return (
    <group>
      {modules.map((module, index) => (
        <group key={module.id} position={[0, module.position[1], 0.72]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[2.62, module.size[1] + 0.02, 0.12]} />
            <meshStandardMaterial color={index % 2 === 0 ? colors.slotA : colors.slotB} roughness={0.46} metalness={0.62} />
          </mesh>
          <mesh position={[0, 0.16, 0.08]} castShadow>
            <boxGeometry args={[2.35, 0.025, 0.035]} />
            <meshStandardMaterial color={colors.slotLine} roughness={0.35} metalness={0.74} />
          </mesh>
          <mesh position={[-1.12, -0.12, 0.09]} castShadow>
            <sphereGeometry args={[0.035, 14, 8]} />
            <meshStandardMaterial color={colors.slotIndicator} emissive={colors.slotIndicatorEmissive} emissiveIntensity={0.08} />
          </mesh>
          <mesh position={[1.12, -0.12, 0.09]} castShadow>
            <boxGeometry args={[0.14, 0.04, 0.045]} />
            <meshStandardMaterial color={colors.slotPort} roughness={0.28} metalness={0.84} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ModuleTray({
  canShowLabel,
  colors,
  isConfigurationComplete,
  isDoorClosed,
  isModuleCovered,
  module,
  activeModule,
  selection,
  setActiveModule,
}) {
  const selectionKey = module.sourceModuleId ?? module.id;
  const groupRef = useRef(null);
  const trayMaterialRef = useRef(null);
  const stripMaterialRef = useRef(null);
  const indicatorMaterialRef = useRef(null);
  const scanMeshRef = useRef(null);
  const scanMaterialRef = useRef(null);
  const pulseRef = useRef(0);
  const pulseModeRef = useRef('select');
  const selectedIndex = module.isConfigured === false
    ? undefined
    : module.isConfigured
      ? (getSelectedIndex(selection, selectionKey) ?? 0)
      : selection[selectionKey];
  const previousSelectedIndexRef = useRef(selectedIndex);
  const isConfigured = module.isConfigured ?? selectedIndex !== undefined;
  const isActive = activeModule === selectionKey || activeModule === module.id;
  const isVisuallyActive = isActive && !isConfigurationComplete && !isDoorClosed && !isModuleCovered;
  const z = isModuleCovered ? 0.56 : isVisuallyActive ? 0.9 : 0.78;
  const trayGlow = isModuleCovered ? 0.01 : isVisuallyActive ? 0.22 : isConfigured ? 0.08 : 0.02;
  const stripGlow = isModuleCovered ? 0.03 : isConfigured ? 0.62 : 0.15;
  const indicatorGlow = isModuleCovered ? 0.03 : isConfigured ? 0.72 : 0.08;
  const canRenderLabel = !isDoorClosed && !isModuleCovered && canShowLabel;
  const selectedOptionName = module.selectedOptionName ?? module.options?.[selectedIndex]?.name;
  const label = isConfigured && selectedOptionName ? selectedOptionName : module.short;

  useEffect(() => {
    const previousSelectedIndex = previousSelectedIndexRef.current;

    if (selectedIndex !== previousSelectedIndex) {
      pulseModeRef.current = selectedIndex === undefined ? 'remove' : 'select';
      pulseRef.current = 1;
    }

    previousSelectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useFrame((_, delta) => {
    const pulse = pulseRef.current;
    const progress = 1 - pulse;
    const isRemoving = pulseModeRef.current === 'remove';
    const flash = pulse > 0 ? Math.sin(progress * Math.PI) : 0;
    const lift = isRemoving ? -flash * 0.04 : flash * 0.09;
    const targetScale = isRemoving ? 1 - flash * 0.018 : 1 + flash * 0.025;

    pulseRef.current = Math.max(0, pulse - delta * 1.35);

    if (groupRef.current) {
      groupRef.current.position.z = MathUtils.damp(groupRef.current.position.z, z + lift, 8.5, delta);
      groupRef.current.scale.setScalar(MathUtils.damp(groupRef.current.scale.x, targetScale, 10, delta));
    }

    if (trayMaterialRef.current) {
      trayMaterialRef.current.emissiveIntensity = MathUtils.damp(
        trayMaterialRef.current.emissiveIntensity,
        trayGlow + flash * (isRemoving ? 0.28 : 0.58),
        9,
        delta,
      );
    }

    if (stripMaterialRef.current) {
      stripMaterialRef.current.emissiveIntensity = MathUtils.damp(
        stripMaterialRef.current.emissiveIntensity,
        stripGlow + flash * (isRemoving ? 0.42 : 1.05),
        9,
        delta,
      );
    }

    if (indicatorMaterialRef.current) {
      const indicatorColor = isRemoving && flash > 0.02
        ? '#f5c15c'
        : isConfigured
          ? '#7df1b4'
          : '#75808a';
      const indicatorEmissive = isRemoving && flash > 0.02
        ? '#f59e0b'
        : isConfigured
          ? '#2fd684'
          : '#111827';

      indicatorMaterialRef.current.color.set(indicatorColor);
      indicatorMaterialRef.current.emissive.set(indicatorEmissive);
      indicatorMaterialRef.current.emissiveIntensity = MathUtils.damp(
        indicatorMaterialRef.current.emissiveIntensity,
        indicatorGlow + flash * (isRemoving ? 0.85 : 1.2),
        9,
        delta,
      );
    }

    if (scanMaterialRef.current) {
      scanMaterialRef.current.color.set(isRemoving ? '#f8d28b' : colors.scan);
      scanMaterialRef.current.emissive.set(isRemoving ? '#f59e0b' : module.color);
      scanMaterialRef.current.opacity = MathUtils.damp(scanMaterialRef.current.opacity, flash * (isRemoving ? 0.36 : 0.5), 12, delta);
    }

    if (scanMeshRef.current) {
      scanMeshRef.current.position.x = isRemoving
        ? module.size[0] * 0.44 - progress * module.size[0] * 0.88
        : -module.size[0] * 0.44 + progress * module.size[0] * 0.88;
    }
  });

  return (
    <group ref={groupRef} position={[module.position[0], module.position[1], z]}>
      <mesh
        castShadow
        onClick={(event) => {
          event.stopPropagation();
          if (isDoorClosed) {
            return;
          }

          setActiveModule(selectionKey);
        }}
      >
        <boxGeometry args={module.size} />
        <meshStandardMaterial
          ref={trayMaterialRef}
          color={isConfigured ? colors.moduleConfigured : colors.moduleEmpty}
          emissive={isConfigured ? module.color : colors.moduleEmptyEmissive}
          emissiveIntensity={trayGlow}
          roughness={0.33}
          metalness={0.68}
        />
      </mesh>

      <mesh position={[0, module.size[1] * 0.36, 0.12]} castShadow>
        <boxGeometry args={[module.size[0] - 0.2, 0.035, 0.035]} />
        <meshStandardMaterial ref={stripMaterialRef} color={module.color} emissive={module.color} emissiveIntensity={stripGlow} />
      </mesh>

      <mesh position={[-module.size[0] * 0.43, -0.09, 0.125]} castShadow>
        <sphereGeometry args={[0.045, 18, 10]} />
        <meshStandardMaterial
          ref={indicatorMaterialRef}
          color={isConfigured ? '#7df1b4' : '#75808a'}
          emissive={isConfigured ? '#2fd684' : '#111827'}
          emissiveIntensity={indicatorGlow}
        />
      </mesh>

      <mesh position={[module.size[0] * 0.42, -0.09, 0.13]} castShadow>
        <boxGeometry args={[0.18, 0.052, 0.052]} />
        <meshStandardMaterial color={colors.modulePort} roughness={0.28} metalness={0.82} />
      </mesh>

      <mesh position={[0, -module.size[1] * 0.33, 0.13]} castShadow>
        <boxGeometry args={[module.size[0] - 0.34, 0.025, 0.035]} />
        <meshStandardMaterial color={colors.moduleLower} roughness={0.56} metalness={0.36} />
      </mesh>

      <mesh ref={scanMeshRef} position={[-module.size[0] * 0.44, 0, 0.145]}>
        <boxGeometry args={[0.16, module.size[1] - 0.1, 0.018]} />
        <meshStandardMaterial
          ref={scanMaterialRef}
          color={colors.scan}
          emissive={module.color}
          emissiveIntensity={1.4}
          opacity={0}
          transparent
        />
      </mesh>

      {canRenderLabel && (
        <Html center distanceFactor={8} position={[0, 0.005, 0.18]} className="module-label module-option-label">
          {label}
        </Html>
      )}
    </group>
  );
}

function DoorPanelSegment({ colors, y }) {
  return (
    <group position={[1.55, y, 0.03]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.86, 0.82, 0.08]} />
        <meshStandardMaterial color={colors.doorPanel} roughness={0.38} metalness={0.78} />
      </mesh>
      <mesh position={[-0.46, 0.12, 0.055]} rotation={[0, 0, -0.42]} castShadow>
        <boxGeometry args={[1.12, 0.055, 0.045]} />
        <meshStandardMaterial color={colors.doorPanelTrim} roughness={0.34} metalness={0.74} />
      </mesh>
      <mesh position={[0.34, -0.13, 0.06]} rotation={[0, 0, 0.5]} castShadow>
        <boxGeometry args={[1.02, 0.052, 0.045]} />
        <meshStandardMaterial color={colors.doorPanelCut} roughness={0.42} metalness={0.72} />
      </mesh>
    </group>
  );
}

function CabinetDoor({
  animateOnMount = false,
  colors,
  isDoorClosed,
  side = 'left',
}) {
  const doorRef = useRef(null);
  const isRightDoor = side === 'right';
  const openAngle = DOOR_OPEN_ANGLE;
  const doorPulseRef = useRef(animateOnMount && !isDoorClosed ? 1 : 0);
  const initialDoorAngleRef = useRef(isDoorClosed || animateOnMount ? DOOR_CLOSED_ANGLE : openAngle);
  const previousDoorClosedRef = useRef(isDoorClosed);
  const edgeMaterialRef = useRef(null);
  const handleMaterialRef = useRef(null);

  useLayoutEffect(() => {
    if (doorRef.current) {
      doorRef.current.rotation.y = initialDoorAngleRef.current;
    }
  }, []);

  useEffect(() => {
    if (previousDoorClosedRef.current !== isDoorClosed) {
      doorPulseRef.current = 1;
      previousDoorClosedRef.current = isDoorClosed;
    }
  }, [isDoorClosed]);

  useFrame((_, delta) => {
    if (!doorRef.current) {
      return;
    }

    const targetAngle = isDoorClosed ? DOOR_CLOSED_ANGLE : openAngle;
    const pulse = doorPulseRef.current;
    const progress = 1 - pulse;
    const flash = pulse > 0 ? Math.sin(progress * Math.PI) : 0;
    const latchMotion = (isDoorClosed ? flash * 0.035 : -flash * 0.018) * (isRightDoor ? -1 : 1);

    doorPulseRef.current = Math.max(0, pulse - delta * 0.9);
    doorRef.current.rotation.y = MathUtils.damp(
      doorRef.current.rotation.y,
      targetAngle + latchMotion,
      isDoorClosed ? 2.15 : 2.85,
      delta,
    );

    if (edgeMaterialRef.current) {
      edgeMaterialRef.current.emissiveIntensity = MathUtils.damp(edgeMaterialRef.current.emissiveIntensity, 0.08 + flash * 0.75, 8, delta);
    }

    if (handleMaterialRef.current) {
      handleMaterialRef.current.emissiveIntensity = MathUtils.damp(handleMaterialRef.current.emissiveIntensity, 0.04 + flash * 0.95, 8, delta);
    }

  });

  return (
    <group position={[isRightDoor ? 1.58 : -1.58, 0.24, 0.88]} scale={[isRightDoor ? -1 : 1, 1, 1]}>
      <mesh position={[0, 0, -0.02]} castShadow>
        <cylinderGeometry args={[0.038, 0.038, 5.28, 22]} />
        <meshStandardMaterial color={colors.hinge} roughness={0.34} metalness={0.9} />
      </mesh>

      <group ref={doorRef}>
        <mesh position={[1.58, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.16, 5.24, 0.1]} />
          <meshStandardMaterial color={colors.doorShell} roughness={0.36} metalness={0.82} />
        </mesh>
        <mesh position={[1.58, 0, -0.075]} castShadow receiveShadow>
          <boxGeometry args={[2.92, 4.92, 0.035]} />
          <meshStandardMaterial color={colors.doorInset} roughness={0.45} metalness={0.62} />
        </mesh>
        <mesh position={[1.58, 0.02, -0.105]} rotation={[0, 0, -0.45]} castShadow>
          <boxGeometry args={[2.35, 0.055, 0.035]} />
          <meshStandardMaterial color={colors.doorBrace} roughness={0.44} metalness={0.68} />
        </mesh>
        <DoorPanelSegment colors={colors} y={1.92} />
        <DoorPanelSegment colors={colors} y={0.88} />
        <DoorPanelSegment colors={colors} y={-0.16} />
        <DoorPanelSegment colors={colors} y={-1.2} />
        <mesh position={[1.58, 2.62, 0.07]} castShadow>
          <boxGeometry args={[3.24, 0.12, 0.16]} />
          <meshStandardMaterial color={colors.doorRail} roughness={0.34} metalness={0.78} />
        </mesh>
        <mesh position={[1.58, -2.62, 0.07]} castShadow>
          <boxGeometry args={[3.24, 0.12, 0.16]} />
          <meshStandardMaterial color={colors.doorRail} roughness={0.34} metalness={0.78} />
        </mesh>
        <mesh position={[3.03, 0, 0.1]} castShadow>
          <boxGeometry args={[0.08, 4.6, 0.12]} />
          <meshStandardMaterial ref={edgeMaterialRef} color={colors.doorEdge} emissive={colors.accent} emissiveIntensity={0.08} roughness={0.35} metalness={0.84} />
        </mesh>
        <mesh position={[2.86, 0.12, 0.19]} castShadow>
          <boxGeometry args={[0.08, 0.78, 0.07]} />
          <meshStandardMaterial ref={handleMaterialRef} color={colors.handle} emissive={colors.handleAccent} emissiveIntensity={0.04} roughness={0.24} metalness={0.88} />
        </mesh>
      </group>
    </group>
  );
}

function ExternalConnection({ end, label, start }) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const length = Math.hypot(dx, dz);
  const rotationY = -Math.atan2(dz, dx);
  const midpoint = [
    start[0] + dx / 2,
    start[1] + dy / 2,
    start[2] + dz / 2,
  ];

  return (
    <group position={midpoint} rotation={[0, rotationY, 0]}>
      {[-0.045, 0.045].map((offset) => (
        <mesh key={offset} position={[0, offset, 0]} castShadow>
          <boxGeometry args={[length, 0.026, 0.026]} />
          <meshStandardMaterial color="#8dd7f7" emissive="#2f88b8" emissiveIntensity={0.34} roughness={0.28} metalness={0.5} />
        </mesh>
      ))}
      <mesh position={[-length / 2, 0, 0]} castShadow>
        <sphereGeometry args={[0.06, 16, 10]} />
        <meshStandardMaterial color="#8dd7f7" emissive="#2f88b8" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[length / 2, 0, 0]} castShadow>
        <boxGeometry args={[0.18, 0.14, 0.08]} />
        <meshStandardMaterial color="#f5c15c" emissive="#f59e0b" emissiveIntensity={0.32} roughness={0.24} metalness={0.74} />
      </mesh>
      {label && (
        <Html center distanceFactor={9} position={[0, 0.26, 0]} className="module-label">
          {label}
        </Html>
      )}
    </group>
  );
}

function ExternalSystemCabinet({
  activeModule,
  module,
  position,
  scale,
  selection,
  setActiveModule,
}) {
  const selectedOption = module.options[selection[module.id]];
  const isActive = activeModule === module.id;
  const accent = module.color;
  const isDasd = module.externalObject === 'dasd';
  const isTape = module.externalObject === 'tape';
  const isVault = module.externalObject === 'vault';
  const cabinetHeight = isTape ? 4.95 : 4.32;
  const cabinetColor = isVault ? '#12151c' : '#20262b';
  const frontColor = isVault ? '#080a0f' : '#11161a';

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        setActiveModule(module.id);
      }}
      position={position}
      rotation={[0, -0.36, 0]}
      scale={scale}
    >
      <mesh position={[0, 0.05, -0.1]} castShadow receiveShadow>
        <boxGeometry args={[2.15, cabinetHeight, 1.22]} />
        <meshStandardMaterial color={cabinetColor} roughness={isVault ? 0.62 : 0.5} metalness={isVault ? 0.82 : 0.7} />
      </mesh>
      <mesh position={[0, 0.05, 0.56]} receiveShadow>
        <boxGeometry args={[1.94, cabinetHeight - 0.28, 0.09]} />
        <meshStandardMaterial color={frontColor} roughness={0.48} metalness={0.68} />
      </mesh>
      <mesh position={[0, cabinetHeight / 2 - 0.2, 0.62]} castShadow>
        <boxGeometry args={[1.78, 0.28, 0.08]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={isActive ? 0.52 : 0.22} roughness={0.34} metalness={0.7} />
      </mesh>

      {isDasd && Array.from({ length: 8 }).map((_, rowIndex) => (
        <group key={rowIndex} position={[0, 1.48 - rowIndex * 0.38, 0.64]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.72, 0.24, 0.12]} />
            <meshStandardMaterial color={rowIndex % 2 === 0 ? '#263039' : '#202832'} roughness={0.42} metalness={0.72} />
          </mesh>
          {Array.from({ length: 4 }).map((__, bayIndex) => (
            <mesh key={bayIndex} position={[-0.58 + bayIndex * 0.38, 0, 0.085]} castShadow>
              <boxGeometry args={[0.28, 0.14, 0.045]} />
              <meshStandardMaterial color="#151b21" roughness={0.34} metalness={0.78} />
            </mesh>
          ))}
          <mesh position={[0.76, -0.03, 0.1]} castShadow>
            <sphereGeometry args={[0.026, 12, 8]} />
            <meshStandardMaterial color="#72f2b4" emissive="#2fd684" emissiveIntensity={0.58} />
          </mesh>
        </group>
      ))}

      {isTape && (
        <group position={[0, 0.03, 0.64]}>
          {Array.from({ length: 24 }).map((_, index) => {
            const column = index % 4;
            const row = Math.floor(index / 4);

            return (
              <mesh key={index} position={[-0.63 + column * 0.42, 1.52 - row * 0.54, 0.055]} castShadow receiveShadow>
                <boxGeometry args={[0.24, 0.42, 0.09]} />
                <meshStandardMaterial color={index % 3 === 0 ? '#2d3338' : '#20252a'} roughness={0.5} metalness={0.64} />
              </mesh>
            );
          })}
          <mesh position={[0, 0.04, 0.13]} castShadow>
            <boxGeometry args={[0.1, 3.55, 0.08]} />
            <meshStandardMaterial color="#b7c0c7" emissive="#5d6870" emissiveIntensity={0.12} roughness={0.36} metalness={0.76} />
          </mesh>
          <mesh position={[0.42, -1.35, 0.15]} castShadow>
            <boxGeometry args={[0.72, 0.28, 0.1]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={isActive ? 0.36 : 0.16} roughness={0.32} metalness={0.74} />
          </mesh>
        </group>
      )}

      {isVault && (
        <group position={[0, 0.03, 0.64]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.54, 3.18, 0.13]} />
            <meshStandardMaterial color="#05070b" roughness={0.68} metalness={0.82} />
          </mesh>
          <mesh position={[0, 0.24, 0.1]} castShadow>
            <boxGeometry args={[0.98, 1.34, 0.08]} />
            <meshStandardMaterial color="#111827" roughness={0.42} metalness={0.88} />
          </mesh>
          <mesh position={[0, 0.24, 0.16]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.08, 32]} />
            <meshStandardMaterial color="#1f2937" emissive={accent} emissiveIntensity={isActive ? 0.2 : 0.08} roughness={0.32} metalness={0.9} />
          </mesh>
          <mesh position={[0, 1.66, 0.12]} castShadow>
            <boxGeometry args={[1.4, 0.06, 0.08]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.22} />
          </mesh>
          <mesh position={[-0.72, -1.72, 0.14]} castShadow>
            <sphereGeometry args={[0.035, 14, 8]} />
            <meshStandardMaterial color="#72f2b4" emissive="#2fd684" emissiveIntensity={0.46} />
          </mesh>
        </group>
      )}

      <mesh position={[-1.06, 0.08, 0.62]} castShadow>
        <boxGeometry args={[0.18, 0.18, 0.1]} />
        <meshStandardMaterial color="#8dd7f7" emissive="#2f88b8" emissiveIntensity={0.34} roughness={0.28} metalness={0.7} />
      </mesh>

      <mesh position={[0, -2.16, 0.12]} castShadow>
        <boxGeometry args={[1.86, 0.2, 1.04]} />
        <meshStandardMaterial color="#0c0f12" roughness={0.56} metalness={0.54} />
      </mesh>

      <Html center distanceFactor={8} position={[0, cabinetHeight / 2 + 0.22, 0.72]} className="module-label external-label">
        {module.title}
      </Html>
      {selectedOption && (
        <Html center distanceFactor={9} position={[0, -cabinetHeight / 2 + 0.44, 0.72]} className="module-label external-option-label">
          {selectedOption.name}
        </Html>
      )}
    </group>
  );
}

function getFramePositions(frameCount, hasExternalSystems) {
  if (frameCount === 2) {
    const shift = hasExternalSystems ? -0.76 : 0;
    const frameSeparation = 3.08;
    const frameAngle = -0.36;
    const halfX = (frameSeparation / 2) * Math.cos(frameAngle);
    const halfZ = -(frameSeparation / 2) * Math.sin(frameAngle);

    return [
      [-halfX + shift, -0.1, -halfZ],
      [halfX + shift, -0.1, halfZ],
    ];
  }

  return [hasExternalSystems ? [-1.36, -0.1, 0] : [0, -0.1, 0]];
}

function getContactShadowLayout(framePositions, externalSystems) {
  const bounds = {
    maxX: Number.NEGATIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
    minX: Number.POSITIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
  };

  const includeFootprint = ([x, , z], halfX, halfZ) => {
    bounds.minX = Math.min(bounds.minX, x - halfX);
    bounds.maxX = Math.max(bounds.maxX, x + halfX);
    bounds.minZ = Math.min(bounds.minZ, z - halfZ);
    bounds.maxZ = Math.max(bounds.maxZ, z + halfZ);
  };

  framePositions.forEach((position) => {
    includeFootprint(position, 3.55, 3.25);
  });

  externalSystems.forEach((system) => {
    includeFootprint(system.position, 1.95, 1.85);
  });

  if (!Number.isFinite(bounds.minX)) {
    return {
      blur: 2.8,
      opacity: 0.52,
      position: [1.2, -2.55, -0.35],
      scale: [15.5, 12.5],
    };
  }

  const sceneWidth = bounds.maxX - bounds.minX;
  const sceneDepth = bounds.maxZ - bounds.minZ;

  return {
    blur: framePositions.length > 1 ? 3.3 : 2.8,
    opacity: externalSystems.length > 0 ? 0.46 : 0.52,
    position: [
      (bounds.minX + bounds.maxX) / 2 + 0.35,
      -2.55,
      (bounds.minZ + bounds.maxZ) / 2 - 0.18,
    ],
    scale: [
      Math.max(15.5, sceneWidth + 5.2),
      Math.max(12.5, sceneDepth + 5.2),
    ],
  };
}

function ProceduralMainframe({
  activeModule,
  animateDoorOnMount = false,
  design,
  doorSide = 'left',
  isDoorClosed,
  modules,
  position,
  selection,
  setActiveModule,
}) {
  const mainframeRef = useRef(null);
  const cameraPosition = useMemo(() => new Vector3(), []);
  const colors = design.colors;
  const isConfigurationComplete = modules.length > 0 && modules.every((module) => (
    module.isConfigured ?? selection[module.sourceModuleId ?? module.id] !== undefined
  ));
  const [isFrontView, setIsFrontView] = useState(true);
  const [areModulesCovered, setAreModulesCovered] = useState(isDoorClosed);

  useEffect(() => {
    if (!isDoorClosed) {
      setAreModulesCovered(false);
      return undefined;
    }

    const coverTimer = window.setTimeout(() => {
      setAreModulesCovered(true);
    }, MODULE_COVER_DELAY_MS);

    return () => {
      window.clearTimeout(coverTimer);
    };
  }, [isDoorClosed]);

  useFrame(({ camera }) => {
    if (!mainframeRef.current) {
      return;
    }

    cameraPosition.copy(camera.position);
    mainframeRef.current.worldToLocal(cameraPosition);

    const horizontalDistance = Math.hypot(cameraPosition.x, cameraPosition.z);
    const frontScore = horizontalDistance > 0 ? cameraPosition.z / horizontalDistance : 0;
    const nextIsFrontView = frontScore > LABEL_FRONT_VIEW_THRESHOLD;

    setIsFrontView((current) => (current === nextIsFrontView ? current : nextIsFrontView));
  });

  return (
    <group ref={mainframeRef} position={position} rotation={[0, -0.36, 0]} scale={0.86}>
      <mesh position={[0, 0.24, -0.18]} castShadow receiveShadow>
        <boxGeometry args={[3.55, 5.42, 1.55]} />
        <meshStandardMaterial color={colors.shell} roughness={0.5} metalness={0.72} />
      </mesh>

      <mesh position={[0, 0.24, 0.66]} receiveShadow>
        <boxGeometry args={[3.22, 5.1, 0.12]} />
        <meshStandardMaterial color={colors.front} roughness={0.42} metalness={0.78} />
      </mesh>

      <mesh position={[0, 0.24, 0.74]} receiveShadow>
        <boxGeometry args={[2.9, 4.72, 0.08]} />
        <meshStandardMaterial color={colors.bay} roughness={0.68} metalness={0.44} />
      </mesh>

      <RackRail colors={colors} x={-1.42} />
      <RackRail colors={colors} x={1.42} />
      <SideVentPattern colors={colors} />
      <RackSlotStack colors={colors} modules={modules} />

      {modules.map((module) => (
        <ModuleTray
          activeModule={activeModule}
          canShowLabel={isFrontView}
          colors={colors}
          isConfigurationComplete={isConfigurationComplete}
          isDoorClosed={isDoorClosed}
          isModuleCovered={areModulesCovered}
          key={module.id}
          module={module}
          selection={selection}
          setActiveModule={setActiveModule}
        />
      ))}

      <mesh position={[0, -2.22, 0.83]} castShadow>
        <boxGeometry args={[2.74, 0.38, 0.16]} />
        <meshStandardMaterial color={colors.base} roughness={0.56} metalness={0.5} />
      </mesh>
      {Array.from({ length: 10 }).map((_, index) => (
        <mesh key={index} position={[0, -2.08 + index * 0.038, 0.93]} castShadow>
          <boxGeometry args={[2.32, 0.012, 0.035]} />
          <meshStandardMaterial color={colors.baseLine} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}

      <mesh position={[0, 2.98, -0.18]} castShadow>
        <boxGeometry args={[3.78, 0.22, 1.72]} />
        <meshStandardMaterial color={colors.topCap} roughness={0.48} metalness={0.76} />
      </mesh>

      <mesh position={[-1.18, -2.62, -0.42]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.12, 20]} />
        <meshStandardMaterial color={colors.foot} roughness={0.45} metalness={0.72} />
      </mesh>
      <mesh position={[1.18, -2.62, -0.42]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.12, 20]} />
        <meshStandardMaterial color={colors.foot} roughness={0.45} metalness={0.72} />
      </mesh>

      <CabinetDoor animateOnMount={animateDoorOnMount} colors={colors} isDoorClosed={isDoorClosed} side={doorSide} />
    </group>
  );
}

export function MainframeScene({
  activeModule,
  background = DEFAULT_SCENE_BACKGROUND,
  design = defaultMainframeDesign,
  frame,
  isDoorClosed,
  modules,
  selection,
  setActiveModule,
}) {
  const colors = design.colors;
  const canvasBackgroundStyle = getCanvasBackgroundStyle(background, colors.canvasBackground);
  const cpcModules = useMemo(() => modules.filter((module) => !isExternalModule(module)), [modules]);
  const selectedExternalModules = useMemo(
    () => modules.filter((module) => isExternalModule(module) && selection[module.id] !== undefined),
    [modules, selection],
  );
  const hasExternalSystems = selectedExternalModules.length > 0;
  const frameCount = frame?.frameCount ?? 1;
  const framePositions = useMemo(
    () => getFramePositions(frameCount, hasExternalSystems),
    [frameCount, hasExternalSystems],
  );
  const cpcPosition = framePositions[0];
  const expansionFramePositions = framePositions.slice(1);
  const aFrameModules = useMemo(
    () => buildAFrameModules(selection, selectedExternalModules, modules),
    [modules, selection, selectedExternalModules],
  );
  const externalSystems = useMemo(() => {
    const connectionSource = framePositions[framePositions.length - 1] ?? [0, -0.1, 0];

    return selectedExternalModules.map((module, index) => {
      const layout = EXTERNAL_SYSTEM_LAYOUT[module.id] ?? {
        offset: [3.7 + index * 1.4, -0.34, -0.8 - index * 1.2],
        scale: 0.66,
      };
      const position = [
        connectionSource[0] + layout.offset[0],
        layout.offset[1],
        layout.offset[2],
      ];

      return {
        connectionEnd: [position[0] - 0.72, position[1] + 0.16, position[2] + 0.44],
        connectionStart: [connectionSource[0] + 1.46, -0.05, connectionSource[2] + 0.62],
        module,
        position,
        scale: layout.scale,
      };
    });
  }, [framePositions, selectedExternalModules]);
  const contactShadowLayout = useMemo(
    () => getContactShadowLayout(framePositions, externalSystems),
    [externalSystems, framePositions],
  );

  return (
    <div className="canvas-wrap" style={canvasBackgroundStyle}>
      <Canvas camera={{ position: [6.8, 3.7, 10.6], fov: 45 }} gl={{ alpha: true }} shadows style={{ background: 'transparent' }}>
        <ambientLight intensity={0.58} />
        <directionalLight
          position={[4, 6, 4]}
          intensity={1.8}
          castShadow
          shadow-bias={-0.00018}
          shadow-camera-bottom={-8.5}
          shadow-camera-far={18}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={8.5}
          shadow-mapSize={[2048, 2048]}
          shadow-normalBias={0.02}
        />
        <spotLight
          position={[-3.8, 4.6, 3.2]}
          angle={0.42}
          penumbra={0.45}
          intensity={2.25}
          castShadow
          shadow-bias={-0.00015}
          shadow-mapSize={[1536, 1536]}
          shadow-normalBias={0.018}
        />

        <Suspense fallback={null}>
          <ProceduralMainframe
            activeModule={activeModule}
            design={design}
            isDoorClosed={isDoorClosed}
            modules={cpcModules}
            position={cpcPosition}
            selection={selection}
            setActiveModule={setActiveModule}
          />
          {expansionFramePositions.map((position, index) => (
            <ProceduralMainframe
              activeModule={activeModule}
              animateDoorOnMount
              design={design}
              doorSide="right"
              isDoorClosed={isDoorClosed}
              key={index === 0 ? 'a-frame' : `expansion-${index}`}
              modules={aFrameModules}
              position={position}
              selection={selection}
              setActiveModule={setActiveModule}
            />
          ))}
          {externalSystems.map((system, index) => (
            <ExternalConnection
              end={system.connectionEnd}
              key={`${system.module.id}-connection`}
              label={index === 0 ? 'FICON / SAN' : ''}
              start={system.connectionStart}
            />
          ))}
          {externalSystems.map((system) => (
            <ExternalSystemCabinet
              activeModule={activeModule}
              key={system.module.id}
              module={system.module}
              position={system.position}
              scale={system.scale}
              selection={selection}
              setActiveModule={setActiveModule}
            />
          ))}
          <BlenderAssetSlots />
          <ContactShadows
            position={contactShadowLayout.position}
            opacity={contactShadowLayout.opacity}
            scale={contactShadowLayout.scale}
            blur={contactShadowLayout.blur}
            far={9.5}
            resolution={768}
          />
          <Environment preset="warehouse" />
        </Suspense>

        <OrbitControls enablePan={false} minDistance={6.2} maxDistance={14.4} />
      </Canvas>
    </div>
  );
}
