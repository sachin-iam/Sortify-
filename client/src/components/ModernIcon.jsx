import React from 'react'
import { motion } from 'framer-motion'
import { 
  EnvelopeIcon, 
  ChartBarIcon, 
  FolderIcon, 
  Cog6ToothIcon,
  UserIcon,
  DocumentArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  SparklesIcon,
  HomeIcon,
  Bars3Icon,
  XMarkIcon,
  ArchiveBoxIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  PencilIcon,
  StarIcon,
  HeartIcon,
  ShareIcon,
  FlagIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  MegaphoneIcon,
  ShieldExclamationIcon,
  QuestionMarkCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'

const ModernIcon = ({ 
  type = 'email', 
  size = 24, 
  className = '',
  color = '#3b82f6',
  glassEffect = true
}) => {
  const iconProps = {
    className: `w-${size} h-${size} ${className}`,
    style: { color }
  }

  const getIcon = () => {
    switch (type) {
      case 'email':
        return <EnvelopeIcon {...iconProps} />
      case 'outlook':
        return <EnvelopeIcon {...iconProps} />
      case 'analytics':
        return <ChartBarIcon {...iconProps} />
      case 'folder':
        return <FolderIcon {...iconProps} />
      case 'target':
        return <SparklesIcon {...iconProps} />
      case 'robot':
        return <SparklesIcon {...iconProps} />
      case 'settings':
        return <Cog6ToothIcon {...iconProps} />
      case 'welcome':
        return <UserIcon {...iconProps} />
      case 'export':
        return <ArrowDownTrayIcon {...iconProps} />
      case 'warning':
        return <ExclamationTriangleIcon {...iconProps} />
      case 'success':
        return <CheckCircleIcon {...iconProps} />
      case 'search':
        return <MagnifyingGlassIcon {...iconProps} />
      case 'sync':
        return <ArrowPathIcon {...iconProps} />
      case 'home':
        return <HomeIcon {...iconProps} />
      case 'menu':
        return <Bars3Icon {...iconProps} />
      case 'close':
        return <XMarkIcon {...iconProps} />
      // Action icons
      case 'archive':
        return <ArchiveBoxIcon {...iconProps} />
      case 'delete':
        return <TrashIcon {...iconProps} />
      case 'download':
        return <ArrowDownTrayIcon {...iconProps} />
      case 'view':
        return <EyeIcon {...iconProps} />
      case 'edit':
        return <PencilIcon {...iconProps} />
      case 'star':
        return <StarIcon {...iconProps} />
      case 'like':
        return <HeartIcon {...iconProps} />
      case 'share':
        return <ShareIcon {...iconProps} />
      case 'flag':
        return <FlagIcon {...iconProps} />
      // Category icons
      case 'academic':
        return <AcademicCapIcon {...iconProps} />
      case 'placement':
        return <BriefcaseIcon {...iconProps} />
      case 'promotions':
        return <MegaphoneIcon {...iconProps} />
      case 'spam':
        return <ShieldExclamationIcon {...iconProps} />
      case 'other':
        return <QuestionMarkCircleIcon {...iconProps} />
      // Navigation icons
      case 'chevron-left':
        return <ChevronLeftIcon {...iconProps} />
      case 'chevron-right':
        return <ChevronRightIcon {...iconProps} />
      default:
        return <EnvelopeIcon {...iconProps} />
    }
  }

  if (glassEffect) {
    return (
      <motion.div
        className="relative inline-block"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <div className="relative">
          {/* Glass background */}
          <div 
            className="absolute inset-0 rounded-lg blur-sm opacity-30"
            style={{ 
              background: `linear-gradient(135deg, ${color}20, ${color}40)`,
              filter: 'blur(2px)'
            }}
          />
          {/* Icon */}
          <div className="relative z-10 p-2 rounded-lg backdrop-blur-sm bg-white/10 border border-white/20">
            {getIcon()}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="inline-block"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      {getIcon()}
    </motion.div>
  )
}

export default ModernIcon
