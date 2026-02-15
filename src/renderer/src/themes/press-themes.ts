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

export type PressThemeName = 'gunmetal' | 'silver' | 'champagne' | 'teal' | 'emerald' | 'brass' | 'military' | 'brand'

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
  // 3. Champagne Silver (warm rose-gold silver)
  // --------------------------------------------------------------------------
  champagne: {
    baseDark: '#d8d2cc',
    baseMid: '#e6e0da',
    baseLight: '#f0ece8',

    accent: '#c57d3c',
    accentLight: '#d4935a',
    accentDark: '#a5632e',
    accentGlow: 'rgba(197,125,60,',

    paper: '#faf8f5',
    paperDark: '#f2efe9',
    paperBorder: '#e0dbd4',
    textOnPaper: '#2a2420',
    textOnPaperMuted: '#8b7e72',

    textPrimary: '#2a2420',
    textMuted: '#7a6e62',

    borderColor: 'rgba(120,100,80,0.15)',
    borderDark: '#ccc6be',

    shadowColor: 'rgba(80,60,40,',
    insetShadowColor: 'rgba(80,60,40,',
    highlightColor: 'rgba(255,252,248,',

    ledGreen: '#16a34a',
    ledAmber: '#d97706',
    ledRed: '#dc2626',

    rivetLight: '#c4bcb4',
    rivetDark: '#a8a098',

    metalSpotColor: 'rgba(160,148,132,',

    placeholderColor: '#b8b0a6',

    navTabActiveFrom: '#f2ede8',
    navTabActiveTo: '#e6e0d8',

    knobOnFrom: '#dda87a',
    knobOnTo: '#c88c5e',
    knobOffFrom: '#c4bcb4',
    knobOffTo: '#b4aca4',
    knobGripOn: 'rgba(165,99,46,0.4)',
    knobGripOff: 'rgba(130,118,106,0.4)',

    isLight: true,
  },

  // --------------------------------------------------------------------------
  // 4. Silver Teal (cool silver + teal accents, high contrast)
  // --------------------------------------------------------------------------
  teal: {
    baseDark: '#d4d8dc',
    baseMid: '#e2e6ea',
    baseLight: '#eef0f2',

    accent: '#0d9488',
    accentLight: '#14b8a6',
    accentDark: '#0f766e',
    accentGlow: 'rgba(13,148,136,',

    paper: '#f8fafb',
    paperDark: '#f0f3f5',
    paperBorder: '#dce0e4',
    textOnPaper: '#1a1a2e',
    textOnPaperMuted: '#5f6b7a',

    textPrimary: '#1a1a2e',
    textMuted: '#5f6b7a',

    borderColor: 'rgba(0,0,0,0.12)',
    borderDark: '#c4c8cc',

    shadowColor: 'rgba(0,0,0,',
    insetShadowColor: 'rgba(0,10,20,',
    highlightColor: 'rgba(255,255,255,',

    ledGreen: '#16a34a',
    ledAmber: '#d97706',
    ledRed: '#dc2626',

    rivetLight: '#bcc0c4',
    rivetDark: '#9ca0a4',

    metalSpotColor: 'rgba(175,180,188,',

    placeholderColor: '#a8aeb4',

    navTabActiveFrom: '#f2f5f7',
    navTabActiveTo: '#e4e8ec',

    knobOnFrom: '#5ec8be',
    knobOnTo: '#3aaa9e',
    knobOffFrom: '#c0c4c8',
    knobOffTo: '#b0b4b8',
    knobGripOn: 'rgba(15,118,110,0.4)',
    knobGripOff: 'rgba(120,124,130,0.4)',

    isLight: true,
  },

  // --------------------------------------------------------------------------
  // 5. Silver Emerald (green-warm silver + emerald accents)
  // --------------------------------------------------------------------------
  emerald: {
    baseDark: '#d6d9d4',
    baseMid: '#e4e7e2',
    baseLight: '#eef0ec',

    accent: '#059669',
    accentLight: '#10b981',
    accentDark: '#047857',
    accentGlow: 'rgba(5,150,105,',

    paper: '#f9faf8',
    paperDark: '#f0f2ee',
    paperBorder: '#dce0d8',
    textOnPaper: '#1a2e1a',
    textOnPaperMuted: '#5f7060',

    textPrimary: '#1a2e1a',
    textMuted: '#5f7060',

    borderColor: 'rgba(0,0,0,0.11)',
    borderDark: '#c4c8c0',

    shadowColor: 'rgba(10,20,10,',
    insetShadowColor: 'rgba(10,20,10,',
    highlightColor: 'rgba(252,255,250,',

    ledGreen: '#10b981',
    ledAmber: '#d97706',
    ledRed: '#dc2626',

    rivetLight: '#bcc0b8',
    rivetDark: '#9ca09a',

    metalSpotColor: 'rgba(170,178,166,',

    placeholderColor: '#a8b0a4',

    navTabActiveFrom: '#f0f4ee',
    navTabActiveTo: '#e2e8de',

    knobOnFrom: '#5dd4a8',
    knobOnTo: '#38b88e',
    knobOffFrom: '#bcc0b8',
    knobOffTo: '#acb0a8',
    knobGripOn: 'rgba(4,120,87,0.4)',
    knobGripOff: 'rgba(110,118,106,0.4)',

    isLight: true,
  },

  // --------------------------------------------------------------------------
  // 6. Aged Brass (warm dark)
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
  // 7. Military (olive/tactical)
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

  // --------------------------------------------------------------------------
  // 8. Brand (navy + green — matches the Mozeus logo)
  // --------------------------------------------------------------------------
  brand: {
    baseDark: '#1b2a4a',
    baseMid: '#223458',
    baseLight: '#2a3f68',

    accent: '#4cb050',
    accentLight: '#66c46a',
    accentDark: '#3a8e3e',
    accentGlow: 'rgba(76,176,80,',

    paper: '#f5f7fa',
    paperDark: '#eaeff5',
    paperBorder: '#c8d0dc',
    textOnPaper: '#1a2444',
    textOnPaperMuted: '#4a5a74',

    textPrimary: '#d0d8e8',
    textMuted: '#7a8aa4',

    borderColor: 'rgba(255,255,255,0.08)',
    borderDark: '#172240',

    shadowColor: 'rgba(0,10,30,',
    insetShadowColor: 'rgba(0,8,24,',
    highlightColor: 'rgba(180,200,240,',

    ledGreen: '#4cb050',
    ledAmber: '#f59e0b',
    ledRed: '#ef4444',

    rivetLight: '#3a4f78',
    rivetDark: '#152038',

    metalSpotColor: 'rgba(42,63,104,',

    placeholderColor: '#5a6a88',

    navTabActiveFrom: '#2a3f68',
    navTabActiveTo: '#223458',

    knobOnFrom: '#66c46a',
    knobOnTo: '#4cb050',
    knobOffFrom: '#2a3f68',
    knobOffTo: '#1b2a4a',
    knobGripOn: 'rgba(76,176,80,0.4)',
    knobGripOff: 'rgba(42,63,104,0.6)',

    isLight: false,
  },
}

export const PRESS_THEME_NAMES: PressThemeName[] = ['brand', 'teal']

export const PRESS_THEME_LABELS: Record<PressThemeName, string> = {
  gunmetal: 'Gunmetal',
  silver: 'Brushed Silver',
  champagne: 'Champagne Silver',
  teal: 'Silver Teal',
  emerald: 'Silver Emerald',
  brass: 'Aged Brass',
  military: 'Military',
  brand: 'Mozeus',
}

// Preview swatch colors (base + accent) for theme picker
export const PRESS_THEME_SWATCHES: Record<PressThemeName, { base: string; accent: string }> = {
  gunmetal: { base: '#22262b', accent: '#cd853f' },
  silver: { base: '#e2e6ea', accent: '#3b82f6' },
  champagne: { base: '#e6e0da', accent: '#c57d3c' },
  teal: { base: '#e2e6ea', accent: '#0d9488' },
  emerald: { base: '#e4e7e2', accent: '#059669' },
  brass: { base: '#252019', accent: '#c9a84c' },
  military: { base: '#232b1e', accent: '#f59e0b' },
  brand: { base: '#1b2a4a', accent: '#4cb050' },
}
