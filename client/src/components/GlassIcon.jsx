import React from 'react'
import { Canvas } from '@react-three/fiber'
import { Sphere, Box, Cylinder, Torus } from '@react-three/drei'
import { motion } from 'framer-motion'

const GlassIcon = ({ 
  type = 'email', 
  size = 24, 
  className = '',
  color = '#3b82f6',
  glassColor = '#ffffff',
  opacity = 0.3
}) => {
  const getIconGeometry = () => {
    switch (type) {
      case 'email':
        return <Box args={[1, 0.6, 0.1]} position={[0, 0, 0]} />
      case 'outlook':
        return <Box args={[1, 0.6, 0.1]} position={[0, 0, 0]} />
      case 'analytics':
        return <Box args={[1, 1, 0.1]} position={[0, 0, 0]} />
      case 'folder':
        return <Box args={[1, 0.8, 0.1]} position={[0, 0, 0]} />
      case 'target':
        return <Torus args={[0.5, 0.2, 8, 16]} position={[0, 0, 0]} />
      case 'robot':
        return <Box args={[0.8, 0.8, 0.8]} position={[0, 0, 0]} />
      case 'settings':
        return <Torus args={[0.4, 0.1, 8, 16]} position={[0, 0, 0]} />
      case 'welcome':
        return <Sphere args={[0.5]} position={[0, 0, 0]} />
      case 'export':
        return <Box args={[0.8, 1, 0.1]} position={[0, 0, 0]} />
      case 'warning':
        return <Box args={[0.6, 0.8, 0.1]} position={[0, 0, 0]} />
      case 'success':
        return <Sphere args={[0.4]} position={[0, 0, 0]} />
      case 'search':
        return <Sphere args={[0.3]} position={[0, 0, 0]} />
      case 'sync':
        return <Torus args={[0.3, 0.1, 8, 16]} position={[0, 0, 0]} />
      default:
        return <Box args={[1, 1, 0.1]} position={[0, 0, 0]} />
    }
  }

  return (
    <motion.div
      className={`inline-block ${className}`}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        style={{ width: size, height: size }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        
        <mesh>
          {getIconGeometry()}
          <meshPhysicalMaterial
            color={color}
            metalness={0.1}
            roughness={0.1}
            transmission={0.8}
            thickness={0.1}
            ior={1.5}
            clearcoat={1}
            clearcoatRoughness={0.1}
            envMapIntensity={1}
          />
        </mesh>
        
        {/* Glass overlay */}
        <mesh>
          {getIconGeometry()}
          <meshPhysicalMaterial
            color={glassColor}
            metalness={0}
            roughness={0}
            transmission={0.9}
            thickness={0.05}
            ior={1.5}
            opacity={opacity}
            transparent
          />
        </mesh>
      </Canvas>
    </motion.div>
  )
}

export default GlassIcon
