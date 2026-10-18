---
name: mobile-saas-anti-slop
description: "Industry-leading mobile design intelligence skill for Expo and React Native. Eradicates generic AI slop (rainbow neon gradients, un-ergonomic web layouts, flat static clicks, box-shadow blur lag) and enforces elite mobile SaaS craftsmanship (Linear, Raycast, Spotify, Apple Human Interface Guidelines). Use for all mobile screens, gestures, design tokens, and components."
---

# Mobile SaaS Anti-Slop Design Skill

This skill enforces strict, production-grade mobile UI/UX engineering for React Native and Expo applications.

---

## 1. The Anti-Slop Audit (What to FORBID)

| ❌ Banned AI Slop Pattern | Why It Fails Native Mobile | ✅ Mandatory Elite Pattern |
|---|---|---|
| **Purple/Cyan Neon Gradients Everywhere** | Cheap AI fingerprint; looks like a 2021 crypto template | **Deep Dark Surface Elevation**: `#09090B` base, `#13131A` card surface, `#1C1C24` raised, with **exactly 1 deliberate accent color** (e.g., Violet `#8B5CF6` or Emerald `#10B981`). |
| **Centered Web Popups / Modals** | Violates thumb zone ergonomics; unreachable with one hand | **Interactive Bottom Sheets**: Slides up from bottom edge with rounded top corners (`borderTopLeftRadius: 24`), thumb drag handles, and drag-down-to-dismiss. |
| **Dead/Flat Touch** | Feels like a slow web page inside a webview | **Micro-Haptics Engine**: `Haptics.impactAsync(Light)` on every touch, `Selection` on tabs, and `NotificationAsync(Success)` on completion. |
| **Heavy Box-Shadows** | Destroys Android GPU fill-rate; causes scroll stutter | **Hairline Layering**: Crisp 1px inner/outer borders (`rgba(255, 255, 255, 0.08)`) and directional surface brightness instead of blurry drop shadows. |
| **Linear CSS Transitions** | Feels robotic, unnatural, and rigid | **Physical Spring Physics**: Natural mass, tension, and damping for cards, sheets, and touch scaling (`transform: [{ scale: 0.98 }]` on press). |
| **Full-Screen Blocking Spinners** | Freezes the user interface and breaks flow | **In-Place Shimmer Skeletons**: Exact geometrical placeholders for cards, avatars, and playlist rows while streaming data. |

---

## 2. Spatial & Ergonomic Token System

All screens must strictly adhere to the following token hierarchy:

### Surface Palette
```javascript
export const COLORS = {
  bg: '#09090E',             // Deepest canvas
  surface: '#13131A',        // Base card / container surface
  surfaceElevated: '#1A1A24', // Modals, bottom sheets, active pills
  surfaceHighlight: '#222230',// Focused states, hover/press overlays
  
  borderSubtle: '#1C1C26',   // Hairline card borders
  borderActive: '#2D2D3D',   // Input focus and active boundaries
  
  textPrimary: '#FFFFFF',    // Headlines, titles, active labels
  textSecondary: '#A0A0B2',  // Subtitles, metadata, timestamps
  textMuted: '#68687D',      // Placeholders, disabled states
  
  accent: '#A855F7',         // SoundGraph primary purple
  accentGlow: 'rgba(168, 85, 247, 0.15)',
  spotify: '#1ED760',        // Spotify platform green
  youtube: '#FF0000',        // YouTube platform red
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444'
};
```

### Spacing & Touch Boundaries
- **Thumb Zone**: All primary buttons, tab bars, and quick actions must reside within the bottom 45% of the viewport.
- **Minimum Touch Target**: Every interactive button or icon touchable must have at least `44x44 dp` of hitSlop or bounding box.
- **Corner Radii**:
  - Micro pills / tags: `8px`
  - Cards & containers: `16px` to `20px`
  - Bottom sheets: `24px` top corners
  - Circular buttons / avatars: `9999px`

---

## 3. High-Performance 3D & Particle Systems
- When implementing 3D orbital animations, visualizers, or sparklers:
  - Calculate true 3D projection: $x' = x \cdot \frac{d}{z + d}$, $y' = y \cdot \frac{d}{z + d}$.
  - Scale particle radius and opacity by depth $z$ to create genuine stereoscopic volume.
  - Run animation updates via native 60fps tick loops with depth sorting so foreground particles occlude background particles.
  - Maintain low battery consumption by keeping particle counts between 40 and 80 points with zero memory allocations inside the render loop.

---

## 4. Multi-Platform SaaS Architecture Checklist
1. **Zero PoC Artifacts**: No "Lorem Ipsum", no hardcoded user IDs, no empty dummy buttons.
2. **Graceful Network Degradation**: If backend LAN disconnects, display a non-intrusive reconnection banner with cached state intact.
3. **Optimistic Updates**: Immediately reflect likes, playlist changes, and tab switches before server roundtrip confirms.
4. **Native Inset Safety**: Dynamic padding calculated from safe area insets to support punch-hole cameras, Dynamic Islands, and Android navigation bars.
