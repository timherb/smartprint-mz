// ---------------------------------------------------------------------------
// Press theme color definitions for the "Printing Press" (D) design concept
// ---------------------------------------------------------------------------

export interface PressThemeColors {
  // Base metal surface
  baseDark: string      // darkest metal
  baseMid: string       // mid metal
  baseLight: string     // lightest metal / highlight edge

  // Accent (gauge bezels, active elements, buttons)
  accent: string
  accentLight: string
  accentDark: string
  accentGlow: string    // for LED/glow effects (rgba string)

  // Paper/content areas
  paper: string
  paperDark: string
  paperBorder: string   // border/separator on paper
  textOnPaper: string
  textOnPaperMuted: string

  // Text on metal
  textPrimary: string
  textMuted: string

  // Border / structural colors
  borderColor: string
  borderDark: string

  // Shadows (rgba strings for box-shadow)
  shadowColor: string       // for box-shadow rgba
  insetShadowColor: string  // for inset shadows
  highlightColor: string    // for raised edge highlights (top-edge inset)

  // LEDs
  ledGreen: string
  ledAmber: string
  ledRed: string

  // Rivet colors
  rivetLight: string
  rivetDark: string

  // Metal noise gradient overlay spots
  metalSpotColor: string

  // Input placeholder color
  placeholderColor: string

  // Active nav tab gradient (from / to)
  navTabActiveFrom: string
  navTabActiveTo: string

  // Knob colors for switch
  knobOnFrom: string
  knobOnTo: string
  knobOffFrom: string
  knobOffTo: string
  knobGripOn: string
  knobGripOff: string

  // Mode for shadow adjustments (light vs dark)
  isLight: boolean
}

export type PressThemeName = 'gunmetal' | 'silver' | 'brass' | 'military'

export const PRESS_THEMES: Record<PressThemeName, PressThemeColors> = {
  // --------------------------------------------------------------------------
  // 1. Gunmetal (dark default)
  // --------------------------------------------------------------------------
  gunmetal: {
    baseDark: '#1a1d21',
    baseMid: '#22262b',
    baseLight: '#2d3238',

    accent: '#cd853f',
    accentLight: '#e0a060',
    accentDark: '#8b5e2b',
    accentGlow: 'rgba(184,115,51,',

    paper: '#f5f0e8',
    paperDark: '#ebe5d9',
    paperBorder: '#d4cfc5',
    textOnPaper: '#1a1a1a',
    textOnPaperMuted: '#8b8178',

    textPrimary: '#c8ccd2',
    textMuted: '#6b7280',

    borderColor: 'rgba(58,63,70,0.4)',
    borderDark: '#15171b',

    shadowColor: 'rgba(0,0,0,',
    insetShadowColor: 'rgba(0,0,0,',
    highlightColor: 'rgba(255,255,255,',

    ledGreen: '#4ade80',
    ledAmber: '#f59e0b',
    ledRed: '#ef4444',

    rivetLight: '#4a4f56',
    rivetDark: '#2a2e33',

    metalSpotColor: 'rgba(58,63,70,',

    placeholderColor: '#3a3f46',

    navTabActiveFrom: '#3a3f46',
    navTabActiveTo: '#2d3238',

    knobOnFrom: '#e8d5b8',
    knobOnTo: '#c8b090',
    knobOffFrom: '#4a4f56',
    knobOffTo: '#3a3f46',
    knobGripOn: 'rgba(139,94,43,0.4)',
    knobGripOff: 'rgba(42,46,51,0.6)',

    isLight: false,
  },

  // --------------------------------------------------------------------------
  // 2. Brushed Silver (light mode)
  // --------------------------------------------------------------------------
  silver: {
    baseDark: '#d4d8dc',
    baseMid: '#e2e6ea',
    baseLight: '#eef0f2',

    accent: '#3b82f6',
    accentLight: '#60a5fa',
    accentDark: '#2563eb',
    accentGlow: 'rgba(59,130,246,',

    paper: '#ffffff',
    paperDark: '#f5f5f5',
    paperBorder: '#e0e0e0',
    textOnPaper: '#1a1a2e',
    textOnPaperMuted: '#6b7280',

    textPrimary: '#1a1a2e',
    textMuted: '#6b7280',

    borderColor: 'rgba(0,0,0,0.1)',
    borderDark: '#c8ccd0',

    shadowColor: 'rgba(0,0,0,',
    insetShadowColor: 'rgba(0,0,0,',
    highlightColor: 'rgba(255,255,255,',

    ledGreen: '#16a34a',
    ledAmber: '#d97706',
    ledRed: '#dc2626',

    rivetLight: '#c0c4c8',
    rivetDark: '#a0a4a8',

    metalSpotColor: 'rgba(180,184,190,',

    placeholderColor: '#b0b4b8',

    navTabActiveFrom: '#f5f7f9',
    navTabActiveTo: '#e8eaee',

    knobOnFrom: '#93bbfd',
    knobOnTo: '#6da1f7',
    knobOffFrom: '#c0c4c8',
    knobOffTo: '#b0b4b8',
    knobGripOn: 'rgba(37,99,235,0.4)',
    knobGripOff: 'rgba(120,124,130,0.4)',

    isLight: true,
  },

  // --------------------------------------------------------------------------
  // 3. Aged Brass (warm dark)
  // --------------------------------------------------------------------------
  brass: {
    baseDark: '#1c1915',
    baseMid: '#252019',
    baseLight: '#302a22',

    accent: '#c9a84c',
    accentLight: '#d4b85c',
    accentDark: '#8b7642',
    accentGlow: 'rgba(201,168,76,',

    paper: '#ede4d0',
    paperDark: '#e5dbc5',
    paperBorder: '#d0c7b0',
    textOnPaper: '#2a2418',
    textOnPaperMuted: '#8b8068',

    textPrimary: '#ddd5c4',
    textMuted: '#8b8068',

    borderColor: 'rgba(70,60,40,0.4)',
    borderDark: '#151210',

    shadowColor: 'rgba(0,0,0,',
    insetShadowColor: 'rgba(0,0,0,',
    highlightColor: 'rgba(255,248,230,',

    ledGreen: '#86efac',
    ledAmber: '#fbbf24',
    ledRed: '#f87171',

    rivetLight: '#4a4535',
    rivetDark: '#2a2518',

    metalSpotColor: 'rgba(70,60,40,',

    placeholderColor: '#3a3520',

    navTabActiveFrom: '#3a3428',
    navTabActiveTo: '#302a22',

    knobOnFrom: '#e0d0a0',
    knobOnTo: '#c0b080',
    knobOffFrom: '#4a4535',
    knobOffTo: '#3a3428',
    knobGripOn: 'rgba(139,118,66,0.4)',
    knobGripOff: 'rgba(42,37,24,0.6)',

    isLight: false,
  },

  // --------------------------------------------------------------------------
  // 4. Military (olive/tactical)
  // --------------------------------------------------------------------------
  military: {
    baseDark: '#1a1f16',
    baseMid: '#232b1e',
    baseLight: '#2d3626',

    accent: '#f59e0b',
    accentLight: '#fbbf24',
    accentDark: '#b45309',
    accentGlow: 'rgba(245,158,11,',

    paper: '#e8e0d0',
    paperDark: '#ddd5c2',
    paperBorder: '#c8c0ae',
    textOnPaper: '#1a1f16',
    textOnPaperMuted: '#7a7560',

    textPrimary: '#c8d5b8',
    textMuted: '#7a8a68',

    borderColor: 'rgba(55,70,40,0.4)',
    borderDark: '#151a12',

    shadowColor: 'rgba(0,0,0,',
    insetShadowColor: 'rgba(0,0,0,',
    highlightColor: 'rgba(220,240,200,',

    ledGreen: '#22c55e',
    ledAmber: '#f59e0b',
    ledRed: '#ef4444',

    rivetLight: '#3d4a32',
    rivetDark: '#232b1e',

    metalSpotColor: 'rgba(55,70,40,',

    placeholderColor: '#3a4530',

    navTabActiveFrom: '#384430',
    navTabActiveTo: '#2d3626',

    knobOnFrom: '#e0c880',
    knobOnTo: '#c0a860',
    knobOffFrom: '#3d4a32',
    knobOffTo: '#2d3626',
    knobGripOn: 'rgba(180,83,9,0.4)',
    knobGripOff: 'rgba(35,43,30,0.6)',

    isLight: false,
  },
}

export const PRESS_THEME_NAMES: PressThemeName[] = ['gunmetal', 'silver', 'brass', 'military']

export const PRESS_THEME_LABELS: Record<PressThemeName, string> = {
  gunmetal: 'Gunmetal',
  silver: 'Brushed Silver',
  brass: 'Aged Brass',
  military: 'Military',
}

// Preview swatch colors (base + accent) for theme picker
export const PRESS_THEME_SWATCHES: Record<PressThemeName, { base: string; accent: string }> = {
  gunmetal: { base: '#22262b', accent: '#cd853f' },
  silver: { base: '#e2e6ea', accent: '#3b82f6' },
  brass: { base: '#252019', accent: '#c9a84c' },
  military: { base: '#232b1e', accent: '#f59e0b' },
}
