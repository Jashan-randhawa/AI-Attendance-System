# 🎨 Frontend Architecture & FitTrack Design System

The frontend is built with **React 18**, **Vite 5**, **TypeScript 5**, and **Tailwind CSS**, adhering to the **FitTrack Design Philosophy** and Apple-grade UI standards.

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

## 3. Collapsible Rail Navigation Architecture

The sidebar (`AppSidebar.tsx`) implements the **FitTrack collapsible rail** pattern:

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
6. **Mobile Responsive Drawer**:
   - Viewports `< md` render a fixed topbar with a hamburger button, triggering a backdrop-blurred slide-in drawer.

---

## 4. Standardized `PageHeader` Partition

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
