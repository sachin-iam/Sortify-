import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Box, Sphere, Cylinder, Torus } from '@react-three/drei'
import * as THREE from 'three'

const Icon3D = ({ 
  type = 'email', 
  position = [0, 0, 0], 
  scale = 1, 
  color = '#3b82f6',
  rotation = [0, 0, 0],
  animate = true 
}) => {
  const meshRef = useRef()

  useFrame((state) => {
    if (animate && meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime) * 0.1
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.05
    }
  })

  const renderIcon = () => {
    switch (type) {
      case 'email':
        return (
          <group ref={meshRef}>
            <Box args={[1, 0.7, 0.1]} position={[0, 0, 0]}>
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </Box>
            <Box args={[0.8, 0.5, 0.05]} position={[0, 0, 0.06]}>
              <meshStandardMaterial color="#ffffff" transparent opacity={0.9} />
            </Box>
            <Text
              fontSize={0.2}
              color="#1f2937"
              position={[0, 0, 0.08]}
              anchorX="center"
              anchorY="middle"
            >
              @
            </Text>
          </group>
        )
      
      case 'analytics':
        return (
          <group ref={meshRef}>
            <Box args={[0.8, 0.8, 0.1]} position={[0, 0, 0]}>
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </Box>
            <Box args={[0.1, 0.4, 0.05]} position={[-0.2, 0.1, 0.06]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
            <Box args={[0.1, 0.6, 0.05]} position={[-0.1, 0.2, 0.06]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
            <Box args={[0.1, 0.3, 0.05]} position={[0, 0.05, 0.06]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
            <Box args={[0.1, 0.7, 0.05]} position={[0.1, 0.25, 0.06]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
            <Box args={[0.1, 0.5, 0.05]} position={[0.2, 0.15, 0.06]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
          </group>
        )
      
      case 'settings':
        return (
          <group ref={meshRef}>
            <Torus args={[0.4, 0.1, 8, 16]} position={[0, 0, 0]}>
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </Torus>
            <Sphere args={[0.15]} position={[0, 0, 0]}>
              <meshStandardMaterial color="#ffffff" />
            </Sphere>
            <Box args={[0.05, 0.3, 0.05]} position={[0, 0.5, 0]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
            <Box args={[0.05, 0.3, 0.05]} position={[0, -0.5, 0]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
            <Box args={[0.3, 0.05, 0.05]} position={[0.5, 0, 0]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
            <Box args={[0.3, 0.05, 0.05]} position={[-0.5, 0, 0]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
          </group>
        )
      
      case 'dashboard':
        return (
          <group ref={meshRef}>
            <Box args={[1, 0.8, 0.1]} position={[0, 0, 0]}>
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </Box>
            <Box args={[0.3, 0.2, 0.05]} position={[-0.3, 0.2, 0.06]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
            <Box args={[0.3, 0.2, 0.05]} position={[0, 0.2, 0.06]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
            <Box args={[0.3, 0.2, 0.05]} position={[0.3, 0.2, 0.06]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
            <Box args={[0.6, 0.2, 0.05]} position={[-0.15, -0.1, 0.06]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
            <Box args={[0.6, 0.2, 0.05]} position={[0.15, -0.1, 0.06]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
          </group>
        )
      
      case 'user':
        return (
          <group ref={meshRef}>
            <Sphere args={[0.3]} position={[0, 0.2, 0]}>
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </Sphere>
            <Cylinder args={[0.4, 0.3, 0.6]} position={[0, -0.2, 0]}>
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </Cylinder>
          </group>
        )
      
      case 'search':
        return (
          <group ref={meshRef}>
            <Sphere args={[0.2]} position={[0, 0, 0]}>
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </Sphere>
            <Cylinder args={[0.05, 0.05, 0.3]} position={[0.15, -0.15, 0]} rotation={[0, 0, Math.PI / 4]}>
              <meshStandardMaterial color="#ffffff" />
            </Cylinder>
          </group>
        )
      
      case 'filter':
        return (
          <group ref={meshRef}>
            <Box args={[0.8, 0.1, 0.1]} position={[0, 0.2, 0]}>
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </Box>
            <Box args={[0.8, 0.1, 0.1]} position={[0, 0, 0]}>
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </Box>
            <Box args={[0.8, 0.1, 0.1]} position={[0, -0.2, 0]}>
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </Box>
            <Box args={[0.1, 0.5, 0.1]} position={[0.3, 0, 0]}>
              <meshStandardMaterial color="#ffffff" />
            </Box>
          </group>
        )
      
      default:
        return (
          <group ref={meshRef}>
            <Sphere args={[0.3]} position={[0, 0, 0]}>
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </Sphere>
          </group>
        )
    }
  }

  return (
    <group position={position} scale={scale} rotation={rotation}>
      {renderIcon()}
    </group>
  )
}

export default Icon3D
