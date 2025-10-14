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
import { 
  Mail, 
  BarChart3, 
  Folder, 
  Settings, 
  User, 
  Download, 
  AlertTriangle, 
  CheckCircle, 
  Search, 
  RefreshCw, 
  Sparkles, 
  Home, 
  Menu, 
  X, 
  Archive, 
  Trash2, 
  Eye, 
  Edit, 
  Star, 
  Heart, 
  Share, 
  Flag, 
  GraduationCap, 
  Briefcase, 
  Megaphone, 
  ShieldAlert, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight,
  Bell,
  Zap,
  Layers,
  Filter,
  MoreHorizontal
} from 'lucide-react'

const ModernIcon = ({ 
  type = 'email', 
  size = 16, 
  className = '',
  color = '#64748b',
  glassEffect = false,
  variant = 'heroicon' // 'heroicon' or 'lucide'
}) => {
  // Size mapping for consistent sizing
  const sizeMap = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24
  }
  
  const actualSize = typeof size === 'string' ? sizeMap[size] || 16 : size
  
  const iconProps = {
    className: `${className}`,
    style: { 
      color,
      width: `${actualSize}px`,
      height: `${actualSize}px`,
      strokeWidth: 1.5
    }
  }

  const getIcon = () => {
    // Use Lucide icons for more minimal variants
    if (variant === 'lucide') {
      switch (type) {
        case 'email':
        case 'outlook':
          return <Mail {...iconProps} />
        case 'analytics':
          return <BarChart3 {...iconProps} />
        case 'folder':
          return <Folder {...iconProps} />
        case 'settings':
          return <Settings {...iconProps} />
        case 'welcome':
        case 'user':
          return <User {...iconProps} />
        case 'export':
        case 'download':
          return <Download {...iconProps} />
        case 'warning':
          return <AlertTriangle {...iconProps} />
        case 'success':
          return <CheckCircle {...iconProps} />
        case 'search':
          return <Search {...iconProps} />
        case 'sync':
          return <RefreshCw {...iconProps} />
        case 'home':
          return <Home {...iconProps} />
        case 'menu':
          return <Menu {...iconProps} />
        case 'close':
          return <X {...iconProps} />
        case 'archive':
          return <Archive {...iconProps} />
        case 'delete':
          return <Trash2 {...iconProps} />
        case 'view':
          return <Eye {...iconProps} />
        case 'edit':
          return <Edit {...iconProps} />
        case 'star':
          return <Star {...iconProps} />
        case 'like':
          return <Heart {...iconProps} />
        case 'share':
          return <Share {...iconProps} />
        case 'flag':
          return <Flag {...iconProps} />
        case 'academic':
          return <GraduationCap {...iconProps} />
        case 'placement':
          return <Briefcase {...iconProps} />
        case 'promotions':
          return <Megaphone {...iconProps} />
        case 'spam':
          return <ShieldAlert {...iconProps} />
        case 'other':
          return <HelpCircle {...iconProps} />
        case 'chevron-left':
          return <ChevronLeft {...iconProps} />
        case 'chevron-right':
          return <ChevronRight {...iconProps} />
        case 'notification':
        case 'bell':
          return <Bell {...iconProps} />
        case 'performance':
        case 'zap':
          return <Zap {...iconProps} />
        case 'layers':
          return <Layers {...iconProps} />
        case 'filter':
          return <Filter {...iconProps} />
        case 'more':
          return <MoreHorizontal {...iconProps} />
        default:
          return <Mail {...iconProps} />
      }
    }
    
    // Default to Heroicons for consistency
    switch (type) {
      case 'email':
      case 'outlook':
        return <EnvelopeIcon {...iconProps} />
      case 'analytics':
        return <ChartBarIcon {...iconProps} />
      case 'folder':
        return <FolderIcon {...iconProps} />
      case 'settings':
        return <Cog6ToothIcon {...iconProps} />
      case 'welcome':
      case 'user':
        return <UserIcon {...iconProps} />
      case 'export':
      case 'download':
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
      case 'archive':
        return <ArchiveBoxIcon {...iconProps} />
      case 'delete':
        return <TrashIcon {...iconProps} />
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
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <div className="relative">
          {/* Minimal glass background */}
          <div 
            className="absolute inset-0 rounded-md blur-sm opacity-20"
            style={{ 
              background: `linear-gradient(135deg, ${color}10, ${color}20)`,
              filter: 'blur(1px)'
            }}
          />
          {/* Icon */}
          <div className="relative z-10 p-1.5 rounded-md backdrop-blur-sm bg-white/5 border border-white/10">
            {getIcon()}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="inline-block"
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      {getIcon()}
    </motion.div>
  )
}

export default ModernIcon
