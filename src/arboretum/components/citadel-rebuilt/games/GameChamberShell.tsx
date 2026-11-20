import * as THREE from 'three';

export function GameChamberShell({
  center,
  radius,
  accentA = 0x8be9ff,
  accentB = 0xc084fc,
  fogNear = 26,
  fogFar = 110,
}: {
  center: [number, number, number];
  radius: number;
  accentA?: number;
  accentB?: number;
  fogNear?: number;
  fogFar?: number;
}) {
  return (
    <>
      <color attach="background" args={['#0a0414']} />
      <fog attach="fog" args={['#0a0414', fogNear, fogFar]} />
      <ambientLight intensity={0.36} />
      <pointLight position={[center[0], 10, center[2]]} color={0x8be9ff} intensity={1.4} distance={140} />
      <pointLight position={[center[0], 7, center[2] + 8]} color={0xf472b6} intensity={0.72} distance={90} />

      <mesh position={[center[0], 0.04, center[2]]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <circleGeometry args={[radius + 0.8, 128]} />
        <meshBasicMaterial color={0x02030a} />
      </mesh>
      <mesh position={[center[0], 0.08, center[2]]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[radius + 0.3, radius + 0.56, 112]} />
        <meshBasicMaterial color={accentA} transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={`shell-ring-${i}`} position={[center[0], 0.09 + i * 0.0015, center[2]]} rotation={[-Math.PI * 0.5, 0, 0]}>
          <ringGeometry args={[7 + i * (radius * 0.13), 7.08 + i * (radius * 0.13), 112]} />
          <meshBasicMaterial color={i % 2 ? accentA : accentB} transparent opacity={0.08} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const x = center[0] + Math.cos(a) * (radius + 1.2);
        const z = center[2] + Math.sin(a) * (radius + 1.2);
        return (
          <group key={`shell-post-${i}`} position={[x, 0.8, z]}>
            <mesh>
              <boxGeometry args={[0.45, 2.8, 0.45]} />
              <meshBasicMaterial color={0xfb923c} wireframe transparent opacity={0.38} />
            </mesh>
            <mesh position={[0, 1.65, 0]}>
              <torusGeometry args={[0.32, 0.05, 6, 16]} />
              <meshBasicMaterial color={accentA} wireframe transparent opacity={0.7} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
