# 🎨 Frontend Architecture & FitTrack Design System

The frontend is built with **React 18**, **Vite 5**, **TypeScript 5**, and **Tailwind CSS**, adhering to the **FitTrack Design Philosophy**, Apple-grade UI standards, and responsive mobile-first engineering.

---

## 1. Editorial Typography System

SmartAttend pairs high-legibility sans-serif with an authoritative editorial serif:

- **Primary Headings (`.font-display`)**: `Playfair Display` (Google Fonts, weights 400 & 600) with tight `-0.025em` tracking. Applied to major page titles, branding wordmarks, and hero banners.
- **Interface & Data Typography**: `Inter` (weights 400, 500, 600, 700) with `-0.015em` negative tracking for crisp micro-copy, tabular data, and input fields.
- **Font Smoothing**: Enabled `-webkit-font-smoothing: antialiased` across the root layout.

---

## 2. Organic 60-30-10 Color System

To avoid aggressive neon or clinical themes, SmartAttend employs a balanced organic color palette:

```
┌────────────────────────────────────────────────────────┐
│  Grounds (60%)  │ Warm Parchment (#f5f5ee) / Deep Ink (#14181a)
├─────────────────┼──────────────────────────────────────┤
│  Inks (30%)     │ High-contrast Graphite (#2f3136) / Stone (#8f948c)
├─────────────────┼──────────────────────────────────────┤
│  Accents (10%)  │ Emerald (#10b981) • Amber (#c9932f) • Brick (#a14a34)
└────────────────────────────────────────────────────────┘
```

- **Primary Accent (Emerald `#10b981`)**: Active states, present badges, primary action triggers.
- **Highlight Accent (Golden Hour Amber `#c9932f`)**: Admin role badges, streak counters, warning alerts.
- **Critical Accent (Muted Brick `#a14a34`)**: Defaulter indicators (<75%), subject deletion modals.

---

## 3. Dual Navigation Architecture

To deliver an optimal experience across large desktop monitors, tablets, and handheld smartphones, SmartAttend employs a responsive **Dual Navigation Architecture**:

### Desktop: Collapsible Rail Navigation (`md:` and above)
The desktop navigation (`AppSidebar.tsx`) implements the **FitTrack collapsible rail** pattern:
1. **Default Collapsed Rail (`68px`)**:
   - Displays 36x36px icon buttons, traffic light window dots (`#ef4444`, `#f59e0b`, `#10b981`), and active indicator pills (`w-1 rounded-r-full bg-emerald-500`).
   - Native HTML tooltips display on hover.
2. **Smooth Hover Expansion (`280px`)**:
   - On cursor entry, smoothly widens to 280px with `shadow-2xl shadow-black/40` and `transition-[width,box-shadow] duration-200 ease-out`.
   - Right panel cells fade in cleanly with labels, badges, and user details.
3. **160ms Anti-Flicker Debounce**:
   - `hoverTimeoutRef` delays un-hover collapse by `160ms`, preventing abrupt snapping during quick cursor motions.
4. **Zero-Layout-Shift Spacer Rail**:
   - A companion `<div className="hidden md:block shrink-0 pointer-events-none ...">` rail ensures page content never shifts when the floating aside expands.
5. **Pin Lock Feature**:
   - Pin button (`Pin` / `PinOff`) allows toggling between auto-collapsing hover mode and permanently pinned-open mode, persisted in `localStorage`.

### Mobile: Sticky Topbar & Bottom Tab Bar (`< md`)
On viewports under 768px:
1. **Mobile Sticky Topbar**:
   - Fixed header with brand mark, active theme toggle (Sun/Moon), and hamburger menu button.
   - Triggers a full-height slide-in navigation drawer with backdrop blur (`bg-background/80 backdrop-blur-md`).
2. **Mobile Bottom Tab Bar**:
   - Fixed bottom tab bar (`fixed bottom-0 left-0 right-0 z-40`) providing thumb-accessible navigation across primary operational views (Scan, Sessions, Directory, Reports).
   - Automatically handles iOS home indicator safe areas with `pb-safe` / `max(0.5rem, env(safe-area-inset-bottom))`.
3. **Main Content Viewport Offset**:
   - Outer container offsets top content by `pt-16` and bottom content by `pb-24 pb-safe`, ensuring zero content clipping behind fixed navigation bars.

---

## 4. Mobile Camera Controls & Scanning UX

In the Live Attendance and Scanning view (`LiveAttendance.tsx`):
- **Camera Device Switcher**: Supports switching between front selfie cameras (`facingMode: "user"`) and high-resolution rear lenses (`facingMode: "environment"`).
- **Mirror Preview Toggle**: Allows users to flip the live camera preview horizontally for natural mirror alignment.
- **Flash / Torch Control**: Toggles hardware flash on supported mobile camera sensors.
- **Stacked Recognition Result Cards**:
  - Live face recognition bounding boxes and identification cards stack vertically into thumb-scrollable cards on mobile viewports rather than side-by-side grids.
  - Matches display subject photo, confidence percentage badge, timestamp, and instant duplicate warning pills.

---

## 5. Window View Modes & Fullscreen Kiosks

SmartAttend includes a built-in `ViewModeContext` allowing users and operators to toggle between display density modes:

- **Contained Mode (`max-w-7xl mx-auto`)**: Balanced reading width with generous margins for standard administrative workflows.
- **Fit Screen Mode (`max-w-none`)**: Fluid edge-to-edge layout utilizing 100% of the display viewport, ideal for wide data tables, 14-day heatmaps, and multi-camera feeds.
- **Fullscreen Kiosk Toggle**: Directly interfaces with the HTML5 Fullscreen API (`document.documentElement.requestFullscreen()`), turning standard tablets and touchscreen laptops into dedicated attendance terminals.

---

## 6. Emil Kowalski Animation Framework & Micro-Interactions

SmartAttend integrates modern animation design principles inspired by Emil Kowalski:
- **Tactile Active Press**: Interactive buttons, cards, and select controls respond with subtle physical depress animations (`active:scale-[0.98]` or `active:scale-95`).
- **Laser Scanner Line**: Active camera viewports display a glowing animated green laser bar sweeping vertically across live video feeds to indicate neural inference.
- **GSAP ScrollTrigger Batch Animations**: Attendance reports and heatmap cards animate sequentially using GSAP timelines with staggered fades and transforms.
- **ContextSafe Match Flashes**: Successfully identified subjects trigger a brief emerald border pulse and confirmation chime.

---

## 7. Performance & Real User Monitoring

- **Vercel Web Analytics (`@vercel/analytics`)**: Tracks real-time page views, visitor engagement, and feature adoption without compromising student privacy.
- **Vercel Speed Insights (`@vercel/speed-insights`)**: Monitors Core Web Vitals (LCP, FID/INP, CLS) across client devices to guarantee sub-second rendering.

---

## 8. Standardized `PageHeader` Partition

All application pages utilize the standardized `PageHeader` component:
```tsx
<PageHeader
  badge="Face Recognition"
  title="Live Attendance Feed"
  description="Automated multi-subject scanning with active bounding boxes."
  actions={<Button>Start Session</Button>}
/>
```
Features an eyebrow badge, `Playfair Display` serif title, descriptive subtitle, action buttons, and a clean horizontal partition divider (`border-b border-border/80 pb-6 mb-8`).
