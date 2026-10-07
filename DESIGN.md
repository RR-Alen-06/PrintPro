# PrintPro — Google Stitch Design System Specification (`DESIGN.md`)

This document defines the **Hybrid Stitch Fusion** design system rules, design tokens, component architecture, and mobile interaction guidelines for the PrintPro Printing Business & POS platform.

---

## 1. Design Principles & Vision

* **AI-Native & Cohesive**: Engineered with Google Stitch MCP design token extraction for continuous design-to-code synchronization.
* **Hybrid Stitch Fusion**: Desktop high-density Slate Precision layout + Mobile Tactile Fintech ergonomics with a floating quick-sale dock.
* **White Canvas Default**: Crisp white background (`#ffffff` / `#f8fafc`) for maximum legibility in high-throughput retail/counter operations, paired with an intentional, high-contrast dark theme (`#0b0f19`).
* **Tabular Lining Numerics**: `JetBrains Mono` for currency amounts (`₹`), SKU codes, quantities, and timestamps to ensure rapid scanning and vertical alignment.
* **Intentional Micro-interactions**: Floating tactile bottom dock with raised POS action trigger, smooth theme switcher transitions, and responsive drawer navigation.

---

## 2. Color Palette & Tonal Elevation

### Light Theme (Default Slate Canvas)
| Token | Hex Value | Usage |
| :--- | :--- | :--- |
| `--bg-main` | `#f8fafc` | Page backdrop canvas (Slate-50) |
| `--bg-canvas` | `#ffffff` | Primary container surface (Pure White) |
| `--bg-card` | `#ffffff` | Elevated card components |
| `--bg-elevated` | `#f1f5f9` | Inputs, sub-panels, headers |
| `--bg-hover` | `#e2e8f0` | Interactive hover state |
| `--bg-surface-tonal` | `#eff6ff` | Tonal highlight surface |
| `--accent` | `#1a73e8` | Google Stitch primary blue |
| `--accent-hover` | `#1557b0` | Button active / focus blue |
| `--accent-surface` | `#e8f0fe` | Active navigation pill & icon container |
| `--pos-action` | `#059669` | High-priority checkout & POS finalize button |
| `--pos-action-hover` | `#047857` | Hover state for checkout button |
| `--text-primary` | `#0f172a` | Slate-900 high-contrast text |
| `--text-secondary` | `#475569` | Slate-600 sub-labels & descriptions |
| `--text-muted` | `#64748b` | Slate-500 timestamps & hints |
| `--border` | `#e2e8f0` | Crisp 1px structural borders |

### Dark Theme (Material Charcoal)
| Token | Hex Value | Usage |
| :--- | :--- | :--- |
| `--bg-main` | `#0b0f19` | Deep charcoal dark canvas |
| `--bg-card` | `#111827` | Dark container surface |
| `--bg-elevated` | `#1e293b` | Elevated sub-sections & inputs |
| `--bg-hover` | `#334155` | Dark interactive hover |
| `--accent` | `#3b82f6` | Google Stitch light blue |
| `--accent-surface` | `rgba(59, 130, 246, 0.2)` | Tonal active pill container |
| `--pos-action` | `#10b981` | Emerald checkout button in dark mode |
| `--text-primary` | `#f8fafc` | Crisp readable dark mode text |
| `--text-secondary` | `#cbd5e1` | Secondary muted text |
| `--border` | `#1e293b` | Dark subtle borders |

### Semantic Status Tokens
* **Success / Settled**: `#16a34a` (Light BG: `#dcfce7`, Dark BG: `rgba(16, 185, 129, 0.16)`)
* **Warning / Dues**: `#d97706` (Light BG: `#fef3c7`, Dark BG: `rgba(245, 158, 11, 0.16)`)
* **Error / Refund**: `#dc2626` (Light BG: `#fee2e2`, Dark BG: `rgba(239, 68, 68, 0.16)`)
* **Info**: `#2563eb` (Light BG: `#dbeafe`, Dark BG: `rgba(59, 130, 246, 0.16)`)

---

## 3. Typography Hierarchy

* **UI Font Stack**: `'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif`
* **Tabular Numerics Stack**: `'JetBrains Mono', monospace`
* **Headings**:
  * `h1` (Display / Page Title): `1.75rem (28px)`, Weight 700, Letter Spacing `-0.025em`
  * `h2` (Section Title): `1.35rem (21.6px)`, Weight 700, Letter Spacing `-0.015em`
  * `h3` (Card / Subsection): `1.15rem (18.4px)`, Weight 600
  * `h4` (Table & Widget Labels): `1.00rem (16px)`, Weight 600
* **Body**: `0.88rem (14px)` to `0.92rem (14.7px)`, Line Height `1.5`
* **Tabular Data**: Amounts (`₹`), quantities, unit prices, and bill IDs use `JetBrains Mono` with `tabular-nums`.

---

## 4. Google Stitch Component System

### 1. Navigation Drawer (`Sidebar.jsx`)
* Categorized section headers: *POS & Billing*, *Customers & Ledgers*, *Stock & Finance*, *Tools & Settings*.
* Active item rendered as a full pill capsule (`border-radius: 9999px`) using `--accent-surface` background and `--accent` text/icon color.

### 2. Top App Bar (`Header.jsx`)
* Centered/Right-aligned Google Search Pill with keyboard shortcut pill (`⌘K`).
* Quick Action Pill (`+ New Bill`).
* Theme Switcher (`Sun` / `Moon` with smooth rotation).
* Stitch User Profile chip with avatar and role description.

### 3. Floating Mobile Tactile Dock (`MobileNavDock.jsx`)
* Rendered on viewports `<= 900px`.
* Translucent container (`rgba(15, 23, 42, 0.92)`, `backdrop-filter: blur(20px)`).
* 4 primary destinations (Home, Bills, Customers, Ledger) + raised emerald center Quick-Sale (+) action button.
* 96px bottom padding clearance on `.main-content` to prevent dock overlap.

### 4. POS Billing & Counter Layout (`Billing.jsx`)
* Split-pane workspace: Product catalogue / quick item search on the left, sticky cart summary & settlement panel on the right.
* Emerald Primary Action button for finalizing bills.
* One-click payment method chips (Cash, UPI, Split, Credit).

### 5. Cash Register (`CashRegister.jsx`)
* Status capsule indicator (`REGISTER ACTIVE — SESSION #id`).
* Live expected cash vs counted variance cards.
* Clean printable Z-Report sheet.

---

## 5. Theme State Synchronization

* Managed via `ThemeContext.jsx` with persistent storage under `localStorage.getItem('printpro-theme')`.
* Reactive `data-theme="light" | "dark"` attribute on `document.documentElement`.
