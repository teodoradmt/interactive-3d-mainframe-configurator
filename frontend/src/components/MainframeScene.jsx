import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Html, OrbitControls, useGLTF } from '@react-three/drei';
import { MathUtils } from 'three';
import { blenderAssets } from '../config/blenderAssets.js';

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

function RackRail({ x }) {
  return (
    <group position={[x, 0.55, 0.63]}>
      <mesh castShadow>
        <boxGeometry args={[0.08, 3.62, 0.08]} />
        <meshStandardMaterial color="#20262d" roughness={0.44} metalness={0.76} />
      </mesh>
      {Array.from({ length: 14 }).map((_, index) => (
        <mesh key={index} position={[0, 1.58 - index * 0.24, 0.06]} castShadow>
          <boxGeometry args={[0.095, 0.045, 0.025]} />
          <meshStandardMaterial color="#77818c" roughness={0.32} metalness={0.72} />
        </mesh>
      ))}
    </group>
  );
}

function VentStack({ x }) {
  return (
    <group position={[x, -1.42, 0.68]}>
      {Array.from({ length: 7 }).map((_, index) => (
        <mesh key={index} position={[0, index * 0.07, 0]} castShadow>
          <boxGeometry args={[1.6, 0.025, 0.04]} />
          <meshStandardMaterial color="#050607" roughness={0.62} metalness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function ModuleTray({ module, activeModule, selection, setActiveModule }) {
  const selectedIndex = selection[module.id];
  const isConfigured = selectedIndex !== undefined;
  const isActive = activeModule === module.id;
  const selectedOption = isConfigured ? module.options[selectedIndex] : null;
  const z = isActive ? 0.74 : 0.66;

  return (
    <group>
      <mesh
        position={[module.position[0], module.position[1], z]}
        castShadow
        onClick={(event) => {
          event.stopPropagation();
          setActiveModule(module.id);
        }}
      >
        <boxGeometry args={module.size} />
        <meshStandardMaterial
          color={isConfigured ? module.color : '#39424d'}
          emissive={isConfigured ? module.color : '#111820'}
          emissiveIntensity={isActive ? 0.36 : isConfigured ? 0.14 : 0.02}
          roughness={0.34}
          metalness={0.52}
        />
      </mesh>

      <mesh position={[module.position[0], module.position[1], z + 0.12]} castShadow>
        <boxGeometry args={[module.size[0] - 0.18, 0.035, 0.04]} />
        <meshStandardMaterial color="#111418" roughness={0.48} metalness={0.68} />
      </mesh>

      <mesh position={[module.position[0] - module.size[0] * 0.42, module.position[1] - 0.18, z + 0.13]} castShadow>
        <sphereGeometry args={[0.045, 18, 10]} />
        <meshStandardMaterial
          color={isConfigured ? '#72f2b4' : '#7b8794'}
          emissive={isConfigured ? '#2fd684' : '#111827'}
          emissiveIntensity={isConfigured ? 0.72 : 0.08}
        />
      </mesh>

      <mesh position={[module.position[0] + module.size[0] * 0.39, module.position[1] - 0.18, z + 0.13]} castShadow>
        <boxGeometry args={[0.18, 0.05, 0.05]} />
        <meshStandardMaterial color="#9aa4af" roughness={0.28} metalness={0.82} />
      </mesh>

      <Html center distanceFactor={8} position={[module.position[0], module.position[1] + 0.01, z + 0.18]} className="module-label">
        {selectedOption ? selectedOption.name : module.short}
      </Html>
    </group>
  );
}

function CabinetDoor({ isDoorClosed }) {
  const doorRef = useRef(null);

  useFrame((_, delta) => {
    if (!doorRef.current) {
      return;
    }

    const targetAngle = isDoorClosed ? 0 : -1.18;
    doorRef.current.rotation.y = MathUtils.damp(doorRef.current.rotation.y, targetAngle, 5.2, delta);
  });

  return (
    <group position={[-2.18, 0.52, 0.76]}>
      <mesh position={[0, 0, -0.01]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 4.16, 22]} />
        <meshStandardMaterial color="#767f8b" roughness={0.34} metalness={0.84} />
      </mesh>

      <group ref={doorRef} rotation={[0, isDoorClosed ? 0 : -1.18, 0]}>
        <mesh position={[2.18, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.36, 4.06, 0.07]} />
          <meshStandardMaterial
            color="#97acbd"
            opacity={0.22}
            transparent
            roughness={0.16}
            metalness={0.18}
            depthWrite={false}
          />
        </mesh>

        <mesh position={[2.18, 2.03, 0.03]} castShadow>
          <boxGeometry args={[4.42, 0.11, 0.13]} />
          <meshStandardMaterial color="#252b32" roughness={0.4} metalness={0.72} />
        </mesh>
        <mesh position={[2.18, -2.03, 0.03]} castShadow>
          <boxGeometry args={[4.42, 0.11, 0.13]} />
          <meshStandardMaterial color="#252b32" roughness={0.4} metalness={0.72} />
        </mesh>
        <mesh position={[0.04, 0, 0.03]} castShadow>
          <boxGeometry args={[0.11, 4.1, 0.13]} />
          <meshStandardMaterial color="#252b32" roughness={0.4} metalness={0.72} />
        </mesh>
        <mesh position={[4.32, 0, 0.03]} castShadow>
          <boxGeometry args={[0.11, 4.1, 0.13]} />
          <meshStandardMaterial color="#252b32" roughness={0.4} metalness={0.72} />
        </mesh>

        <mesh position={[4.02, 0, 0.12]} castShadow>
          <boxGeometry args={[0.11, 0.86, 0.09]} />
          <meshStandardMaterial color="#c4cad1" roughness={0.24} metalness={0.88} />
        </mesh>
      </group>
    </group>
  );
}

function ProceduralMainframe({ activeModule, modules, selection, setActiveModule, isDoorClosed }) {
  return (
    <group rotation={[0, -0.28, 0]}>
      <mesh position={[0, 0.52, -0.11]} castShadow receiveShadow>
        <boxGeometry args={[4.72, 4.45, 1.12]} />
        <meshStandardMaterial color="#14191f" roughness={0.58} metalness={0.62} />
      </mesh>

      <mesh position={[0, 0.52, 0.52]} receiveShadow>
        <boxGeometry args={[4.38, 4.08, 0.08]} />
        <meshStandardMaterial color="#242b33" roughness={0.5} metalness={0.72} />
      </mesh>

      <mesh position={[0, 0.52, 0.58]} receiveShadow>
        <boxGeometry args={[4.04, 3.72, 0.08]} />
        <meshStandardMaterial color="#0e1115" roughness={0.64} metalness={0.46} />
      </mesh>

      <RackRail x={-2.02} />
      <RackRail x={2.02} />

      {modules.map((module) => (
        <ModuleTray
          activeModule={activeModule}
          key={module.id}
          module={module}
          selection={selection}
          setActiveModule={setActiveModule}
        />
      ))}

      <VentStack x={-1.08} />
      <VentStack x={1.08} />

      <mesh position={[0, -1.82, 0.64]} castShadow>
        <boxGeometry args={[4.2, 0.34, 0.18]} />
        <meshStandardMaterial color="#171c22" roughness={0.44} metalness={0.76} />
      </mesh>
      <mesh position={[0, 2.79, 0.02]} castShadow>
        <boxGeometry args={[4.86, 0.28, 1.24]} />
        <meshStandardMaterial color="#20262d" roughness={0.52} metalness={0.72} />
      </mesh>

      <mesh position={[-1.74, -1.92, -0.28]} castShadow>
        <boxGeometry args={[0.52, 0.22, 0.6]} />
        <meshStandardMaterial color="#0a0c0f" roughness={0.5} metalness={0.55} />
      </mesh>
      <mesh position={[1.74, -1.92, -0.28]} castShadow>
        <boxGeometry args={[0.52, 0.22, 0.6]} />
        <meshStandardMaterial color="#0a0c0f" roughness={0.5} metalness={0.55} />
      </mesh>

      <CabinetDoor isDoorClosed={isDoorClosed} />
    </group>
  );
}

export function MainframeScene({
  activeModule,
  isDoorClosed,
  modules,
  selection,
  setActiveModule,
}) {
  return (
    <div className="canvas-wrap">
      <Canvas camera={{ position: [4.85, 3.2, 6.5], fov: 41 }} shadows>
        <color attach="background" args={['#101113']} />
        <ambientLight intensity={0.64} />
        <directionalLight position={[4, 5, 4]} intensity={1.8} castShadow />
        <spotLight position={[-3.8, 4.2, 2.7]} angle={0.42} penumbra={0.45} intensity={2.1} castShadow />

        <Suspense fallback={null}>
          <ProceduralMainframe
            activeModule={activeModule}
            isDoorClosed={isDoorClosed}
            modules={modules}
            selection={selection}
            setActiveModule={setActiveModule}
          />
          <BlenderAssetSlots />
          <ContactShadows position={[0, -2.05, 0]} opacity={0.5} scale={8} blur={2.6} />
          <Environment preset="warehouse" />
        </Suspense>

        <OrbitControls enablePan={false} minDistance={5} maxDistance={9} />
      </Canvas>
    </div>
  );
}
