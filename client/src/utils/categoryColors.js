/**
 * Dynamic category color generation utility
 * Generates consistent, accessible colors based on category name hash
 */

/**
 * Simple hash function to convert string to number
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
function stringToHash(str) {
  let hash = 0
  if (str.length === 0) return hash
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  return Math.abs(hash)
}

/**
 * Generate HSL color from category name
 * @param {string} categoryName - Name of the category
 * @returns {object} HSL color object { h, s, l }
 */
function generateHSLColor(categoryName) {
  if (!categoryName) {
    return { h: 0, s: 50, l: 50 }
  }
  
  const hash = stringToHash(categoryName.toLowerCase().trim())
  
  // Generate hue (0-360) for good color distribution
  const hue = hash % 360
  
  // Use FULL color spectrum with higher saturation for MORE vibrant, distinct colors
  const saturation = 70 + (hash % 20) // 70-90% (increased from 65-80%)
  
  // Use medium lightness for good contrast with better range
  const lightness = 45 + (hash % 15) // 45-60% (adjusted from 50-70%)
  
  return {
    h: hue,
    s: Math.min(saturation, 80), // Cap saturation for accessibility
    l: Math.max(45, Math.min(lightness, 65)) // Ensure good contrast range
  }
}

/**
 * Convert HSL to hex color
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex color
 */
function hslToHex(h, s, l) {
  h = h / 360
  s = s / 100
  l = l / 100

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }

  let r, g, b

  if (s === 0) {
    r = g = b = l // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }

  const toHex = (c) => {
    const hex = Math.round(c * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Convert HSL to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {object} RGB color object { r, g, b }
 */
function hslToRgb(h, s, l) {
  h = h / 360
  s = s / 100
  l = l / 100

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }

  let r, g, b

  if (s === 0) {
    r = g = b = l // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}

/**
 * Get category color in various formats
 * @param {string} categoryName - Name of the category
 * @param {string} format - Format type: 'hex', 'rgb', 'hsl', 'gradient', 'tailwind'
 * @returns {string} Color in requested format
 */
export function getCategoryColor(categoryName, format = 'gradient') {
  if (!categoryName) {
    return format === 'tailwind' ? 'from-gray-500 to-gray-600' : '#6b7280'
  }
  
  const hsl = generateHSLColor(categoryName)
  const { h, s, l } = hsl
  
  switch (format) {
    case 'hex':
      return hslToHex(h, s, l)
    
    case 'rgb': {
      const rgb = hslToRgb(h, s, l)
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
    }
    
    case 'hsl':
      return `hsl(${h}, ${s}%, ${l}%)`
    
    case 'gradient': {
      // Generate a slightly different shade for gradient end
      const endL = Math.max(l - 5, 35) // Darker end color
      const hex = hslToHex(h, s, l)
      const endHex = hslToHex(h, s, endL)
      
      // Extract RGB values for Tailwind-style gradient
      const rgb = hslToRgb(h, s, l)
      const endRgb = hslToRgb(h, s, endL)
      
      // Convert to approximate Tailwind colors
      const getTailwindColor = (r, g, b) => {
        // Simple mapping to Tailwind color scale
        const brightness = (r + g + b) / 3
        if (brightness < 85) return 'gray'
        if (brightness < 170) return 'slate'
        if (r > g && r > b) {
          if (r > 200) return 'red'
          if (r > 150) return 'orange'
          return 'amber'
        }
        if (g > r && g > b) {
          if (g > 200) return 'green'
          if (g > 150) return 'emerald'
          return 'lime'
        }
        if (b > r && b > g) {
          if (b > 200) return 'blue'
          if (b > 150) return 'cyan'
          return 'sky'
        }
        if (r > 200 && g > 150) return 'yellow'
        if (r > 150 && b > 150) return 'purple'
        if (g > 150 && b > 150) return 'teal'
        return 'gray'
      }
      
      const baseColor = getTailwindColor(rgb.r, rgb.g, rgb.b)
      const endColor = getTailwindColor(endRgb.r, endRgb.g, endRgb.b)
      
      return `from-${baseColor}-500 to-${endColor}-600`
    }
    
    case 'tailwind':
      return getCategoryColor(categoryName, 'gradient')
    
    default:
      return hslToHex(h, s, l)
  }
}

/**
 * Get a solid color class for buttons and other solid elements
 * @param {string} categoryName - Name of the category
 * @returns {string} Tailwind color class
 */
export function getCategorySolidColor(categoryName) {
  if (!categoryName) {
    return 'bg-gray-500'
  }
  
  const hsl = generateHSLColor(categoryName)
  const { h, s, l } = hsl
  const rgb = hslToRgb(h, s, l)
  
  // Map to Tailwind colors based on hue and brightness
  if (h < 30 || h > 330) {
    return l > 60 ? 'bg-red-500' : 'bg-red-600'
  } else if (h < 60) {
    return l > 60 ? 'bg-orange-500' : 'bg-orange-600'
  } else if (h < 120) {
    return l > 60 ? 'bg-green-500' : 'bg-green-600'
  } else if (h < 180) {
    return l > 60 ? 'bg-cyan-500' : 'bg-cyan-600'
  } else if (h < 240) {
    return l > 60 ? 'bg-blue-500' : 'bg-blue-600'
  } else if (h < 300) {
    return l > 60 ? 'bg-purple-500' : 'bg-purple-600'
  } else {
    return l > 60 ? 'bg-pink-500' : 'bg-pink-600'
  }
}

/**
 * Get text color that contrasts well with the category color
 * @param {string} categoryName - Name of the category
 * @returns {string} Tailwind text color class
 */
export function getCategoryTextColor(categoryName) {
  if (!categoryName) {
    return 'text-gray-600'
  }
  
  const hsl = generateHSLColor(categoryName)
  const { l } = hsl
  
  // Return white text for darker backgrounds, dark text for lighter
  return l < 55 ? 'text-white' : 'text-slate-800'
}

/**
 * Get border color for category
 * @param {string} categoryName - Name of the category
 * @returns {string} Tailwind border color class
 */
export function getCategoryBorderColor(categoryName) {
  if (!categoryName) {
    return 'border-gray-300'
  }
  
  const hsl = generateHSLColor(categoryName)
  const { h, s, l } = hsl
  const rgb = hslToRgb(h, s, Math.max(l - 10, 30)) // Darker border
  
  // Simple mapping similar to solid color
  if (h < 30 || h > 330) return 'border-red-300'
  if (h < 60) return 'border-orange-300'
  if (h < 120) return 'border-green-300'
  if (h < 180) return 'border-cyan-300'
  if (h < 240) return 'border-blue-300'
  if (h < 300) return 'border-purple-300'
  return 'border-pink-300'
}

/**
 * Get light background + dark text color classes for badges/chips (used in EmailList)
 * @param {string} categoryName - Name of the category
 * @returns {string} Combined Tailwind classes for background and text
 */
export function getCategoryLightColors(categoryName) {
  if (!categoryName) {
    return 'bg-gray-100 text-gray-800'
  }
  
  const hsl = generateHSLColor(categoryName)
  const { h } = hsl
  
  // Map to light background colors based on hue
  if (h < 30 || h > 330) {
    return 'bg-red-100 text-red-800'
  } else if (h < 60) {
    return 'bg-orange-100 text-orange-800'
  } else if (h < 120) {
    return 'bg-green-100 text-green-800'
  } else if (h < 180) {
    return 'bg-cyan-100 text-cyan-800'
  } else if (h < 240) {
    return 'bg-blue-100 text-blue-800'
  } else if (h < 300) {
    return 'bg-purple-100 text-purple-800'
  } else {
    return 'bg-pink-100 text-pink-800'
  }
}

export default {
  getCategoryColor,
  getCategorySolidColor,
  getCategoryTextColor,
  getCategoryBorderColor,
  getCategoryLightColors,
  generateHSLColor,
  stringToHash
}
