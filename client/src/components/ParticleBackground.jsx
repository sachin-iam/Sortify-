import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

function FloatingParticles({ count = 1000 }) {
  const points = useRef()
  
  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(count * 3)
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20
    }
    
    return positions
  }, [count])

  useFrame((state) => {
    if (points.current) {
      points.current.rotation.x = state.clock.elapsedTime * 0.05
      points.current.rotation.y = state.clock.elapsedTime * 0.075
    }
  })

  return (
    <Points ref={points} positions={particlesPosition} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#ffffff"
        size={0.02}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.6}
      />
    </Points>
  )
}

function FloatingOrbs() {
  const orb1 = useRef()
  const orb2 = useRef()
  const orb3 = useRef()

  useFrame((state) => {
    if (orb1.current) {
      orb1.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 2
      orb1.current.rotation.x = state.clock.elapsedTime * 0.1
      orb1.current.rotation.y = state.clock.elapsedTime * 0.15
    }
    if (orb2.current) {
      orb2.current.position.y = Math.sin(state.clock.elapsedTime * 0.3 + Math.PI) * 1.5
      orb2.current.rotation.x = state.clock.elapsedTime * -0.08
      orb2.current.rotation.y = state.clock.elapsedTime * 0.12
    }
    if (orb3.current) {
      orb3.current.position.y = Math.sin(state.clock.elapsedTime * 0.7 + Math.PI * 0.5) * 1.8
      orb3.current.rotation.x = state.clock.elapsedTime * 0.06
      orb3.current.rotation.y = state.clock.elapsedTime * -0.1
    }
  })

  return (
    <>
      <mesh ref={orb1} position={[8, 0, -5]}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.1} />
      </mesh>
      <mesh ref={orb2} position={[-8, 0, -3]}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.1} />
      </mesh>
      <mesh ref={orb3} position={[0, 0, -8]}>
        <sphereGeometry args={[1.8, 32, 32]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.1} />
      </mesh>
    </>
  )
}

export default function ParticleBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <FloatingParticles count={1000} />
        <FloatingOrbs />
      </Canvas>
    </div>
  )
}
