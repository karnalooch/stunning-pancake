import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Milestone 7.2: Three.js / React Three Fiber Globe Visualization
const AnimatedGlobe = () => {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
      meshRef.current.rotation.x += 0.002;
    }
  });

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]} scale={2.5}>
      <MeshDistortMaterial
        color="#00D1FF"
        attach="material"
        distort={0.3}
        speed={1.5}
        roughness={0.2}
        metalness={0.8}
        wireframe
      />
    </Sphere>
  );
};

export const GlobePreview: React.FC = () => {
  return (
    <div style={{ width: '100%', height: '500px', background: 'radial-gradient(circle, #1a1f26 0%, #0b0e14 100%)', borderRadius: '24px', overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} />
        <AnimatedGlobe />
        <OrbitControls enableZoom={false} />
      </Canvas>
      <div style={{ position: 'absolute', bottom: '24px', left: '24px', pointerEvents: 'none' }}>
        <h2 style={{ margin: 0, fontWeight: 900, color: '#fff', fontSize: '24px', letterSpacing: '-1px' }}>Global Telemetry Hub</h2>
        <p style={{ margin: 0, color: '#94A3B8', fontWeight: 600 }}>Milestone 7.2 | Three.js + R3F</p>
      </div>
    </div>
  );
};
