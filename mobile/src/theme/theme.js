// True Fluid Translucent Glassmorphism Design Tokens
// Warm ambient espresso backdrop with ultra-frosted translucent glass & pure white active pills
export const THEME = {
  colors: {
    // Ambient Warm Canvas
    bg: '#0E0C0B',
    bgWarmGradient: ['#1A120E', '#0E0C0B', '#140D0A'],
    
    // Ambient warm glow orbs for glass refraction
    glowAmber: 'rgba(245, 158, 11, 0.20)',
    glowTerracotta: 'rgba(234, 88, 12, 0.16)',
    glowWarmWhite: 'rgba(255, 255, 255, 0.08)',
    
    // Translucent Frosted Glass (Ultra-visible refraction)
    glassSurface: 'rgba(255, 255, 255, 0.11)',
    glassSurfaceElevated: 'rgba(255, 255, 255, 0.18)',
    glassSurfacePressed: 'rgba(255, 255, 255, 0.24)',
    
    // Crisp Specular Glass Borders
    glassBorder: 'rgba(255, 255, 255, 0.22)',
    glassBorderHighlight: 'rgba(255, 255, 255, 0.38)',
    glassBorderSubtle: 'rgba(255, 255, 255, 0.14)',
    
    // Active High-Contrast Solid Pill (As seen in reference image)
    pillActiveBg: '#FFFFFF',
    pillActiveText: '#181716',
    
    // Inactive Translucent Pill
    pillInactiveBg: 'rgba(255, 255, 255, 0.10)',
    pillInactiveBorder: 'rgba(255, 255, 255, 0.20)',
    pillInactiveText: 'rgba(255, 255, 255, 0.80)',
    
    // Typography
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.74)',
    textMuted: 'rgba(255, 255, 255, 0.46)',
    
    // Soft Warm Accents (No harsh saturated purples!)
    accentWarm: '#F59E0B',        // Warm Amber
    accentTerracotta: '#EA580C',  // Soft Terracotta
    accentWhite: '#FFFFFF',
    
    spotify: '#1DB954',
    youtube: '#EF4444',
    success: '#10B981',
    danger: '#EF4444'
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48
  },
  
  radius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 22,
    xl: 28,
    xxl: 34,
    full: 9999
  },

  fonts: {
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
    semiBold: 'DMSans_600SemiBold',
    bold: 'DMSans_700Bold'
  }
};

