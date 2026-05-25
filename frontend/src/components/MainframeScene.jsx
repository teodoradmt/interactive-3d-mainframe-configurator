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

function RackSlotStack({ colors }) {
  const yPositions = [1.72, 1.08, 0.44, -0.2, -0.84, -1.48];

  return (
    <group>
      {yPositions.map((y, index) => (
        <group key={y} position={[0, y, 0.72]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[2.62, 0.48, 0.12]} />
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
  const groupRef = useRef(null);
  const trayMaterialRef = useRef(null);
  const stripMaterialRef = useRef(null);
  const indicatorMaterialRef = useRef(null);
  const scanMeshRef = useRef(null);
  const scanMaterialRef = useRef(null);
  const pulseRef = useRef(0);
  const pulseModeRef = useRef('select');
  const previousSelectedIndexRef = useRef(selection[module.id]);
  const selectedIndex = selection[module.id];
  const isConfigured = selectedIndex !== undefined;
  const isActive = activeModule === module.id;
  const isVisuallyActive = isActive && !isConfigurationComplete && !isDoorClosed && !isModuleCovered;
  const selectedOption = isConfigured ? module.options[selectedIndex] : null;
  const z = isModuleCovered ? 0.56 : isVisuallyActive ? 0.9 : 0.78;
  const trayGlow = isModuleCovered ? 0.01 : isVisuallyActive ? 0.22 : isConfigured ? 0.08 : 0.02;
  const stripGlow = isModuleCovered ? 0.03 : isConfigured ? 0.62 : 0.15;
  const indicatorGlow = isModuleCovered ? 0.03 : isConfigured ? 0.72 : 0.08;
  const canRenderLabel = !isDoorClosed && !isModuleCovered && canShowLabel;

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

          setActiveModule(module.id);
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
        <Html center distanceFactor={8} position={[0, 0.005, 0.18]} className="module-label">
          {selectedOption ? selectedOption.name : module.short}
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

function CabinetDoor({ colors, isDoorClosed }) {
  const doorRef = useRef(null);
  const doorPulseRef = useRef(0);
  const initialDoorAngleRef = useRef(isDoorClosed ? DOOR_CLOSED_ANGLE : DOOR_OPEN_ANGLE);
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

    const targetAngle = isDoorClosed ? DOOR_CLOSED_ANGLE : DOOR_OPEN_ANGLE;
    const pulse = doorPulseRef.current;
    const progress = 1 - pulse;
    const flash = pulse > 0 ? Math.sin(progress * Math.PI) : 0;
    const latchMotion = isDoorClosed ? flash * 0.035 : -flash * 0.018;

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
    <group position={[-1.58, 0.24, 0.88]}>
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

function ProceduralMainframe({ activeModule, design, modules, selection, setActiveModule, isDoorClosed }) {
  const mainframeRef = useRef(null);
  const cameraPosition = useMemo(() => new Vector3(), []);
  const colors = design.colors;
  const isConfigurationComplete = modules.length > 0 && modules.every((module) => selection[module.id] !== undefined);
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
    <group ref={mainframeRef} position={[0, -0.1, 0]} rotation={[0, -0.36, 0]} scale={0.86}>
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
      <RackSlotStack colors={colors} />

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

      <CabinetDoor colors={colors} isDoorClosed={isDoorClosed} />
    </group>
  );
}

export function MainframeScene({
  activeModule,
  design = defaultMainframeDesign,
  isDoorClosed,
  modules,
  selection,
  setActiveModule,
}) {
  const colors = design.colors;

  return (
    <div className="canvas-wrap">
      <Canvas camera={{ position: [4.55, 3.35, 7.8], fov: 38 }} shadows>
        <color attach="background" args={[colors.canvasBackground]} />
        <ambientLight intensity={0.58} />
        <directionalLight position={[4, 6, 4]} intensity={1.8} castShadow />
        <spotLight position={[-3.8, 4.6, 3.2]} angle={0.42} penumbra={0.45} intensity={2.25} castShadow />

        <Suspense fallback={null}>
          <ProceduralMainframe
            activeModule={activeModule}
            design={design}
            isDoorClosed={isDoorClosed}
            modules={modules}
            selection={selection}
            setActiveModule={setActiveModule}
          />
          <BlenderAssetSlots />
          <ContactShadows position={[0, -2.55, 0]} opacity={0.52} scale={8} blur={2.8} />
          <Environment preset="warehouse" />
        </Suspense>

        <OrbitControls enablePan={false} minDistance={6.2} maxDistance={10.4} />
      </Canvas>
    </div>
  );
}
