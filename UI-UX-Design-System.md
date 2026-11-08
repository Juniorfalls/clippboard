# Clippboard UI/UX Design System & Requirements Document
**Project:** Clippboard - AI Video Clipping SaaS
**References:** Solbot Dashboard (Auth), Kit (Landing Page)
**Strict Constraint:** Zero native browser elements (no `<select>`, `<input type="file">`, `window.alert`, etc.)

---

## 1. Global Design Tokens (Extracted from References)

### 1.1 Typography
The design relies heavily on a geometric, sans-serif font family (e.g., Inter, Satoshi, or Outfit).
- **Hero Headings (H1):** `text-[64px]` (mobile) to `text-[80px]` (desktop). 
  - Line height: `leading-[0.95]` (95%).
  - Letter spacing: `tracking-tight` or `-tracking-1`.
- **Section Headings (H2):** `text-[40px]` to `text-[48px]`, `leading-[1]` (100%).
- **Card Headings (H3/H5):** `text-[24px]` to `text-[32px]`, `leading-[1.25]`.
- **Body Text (Standard):** `text-[16px]` to `text-[18px]`.
- **Small Text (Captions/Footers):** `text-[12px]` to `text-[14px]`.
- **Font Weights:** Headings use `font-bold` or `font-semibold`. Body text is `font-normal`. Links/Buttons are `font-semibold`.

### 1.2 Color Palette
**From Kit (Landing Page):**
- **Warm White (Main Background):** `#F9F7F4` (Tailwind: `bg-warm-white`)
- **Soft Black (Text/Dark Sections):** `#1C1C1C` (Tailwind: `text-soft-black` / `bg-soft-black`)
- **Brand Blue (Primary CTA):** `#3B82F6` (Tailwind: `bg-blue-500`)
- **Brand Blue Hover:** `#93C5FD` (Tailwind: `bg-blue-200`)
- **Light Blue Border:** `#DBEAFE` (Tailwind: `border-blue-200`)
- **Card Overlay:** `rgba(249, 247, 244, 0.1)` (Tailwind: `bg-warm-white/10`)
- **Border Gray:** `#E5E7EB` (Tailwind: `border-gray-800`)

**From Solbot (Auth Page):**
- **Theme:** `data-theme="auto"` (Supports light/dark mode via CSS variables).
- **Input Background:** Custom (`authinput` class) – likely transparent or subtle gray.
- **Primary Button:** Custom (`btn--primary`) – likely brand primary color.

### 1.3 Spacing & Radii
- **Border Radius:** 
  - Buttons: `rounded-2` (8px) on mobile, `rounded-3` (12px) on desktop.
  - Cards/Images: `rounded-3` (12px) or `rounded-lg` (8px).
- **Borders:** 
  - Hero Images: `border-4` (thick 4px border).
  - Cards: `border` (1px subtle border) or no border.
- **Grid System:** 
  - Max-width container: `1280px`.
  - Layout: `grid-cols-[1fr_min(1280px,100%)_1fr]` (centered content with equal side margins).
  - Section Padding: `py-16` to `py-20` (vertical), `px-3 xs:px-4` (horizontal).

---

## 2. Strict Rules: "No Native Elements"

To achieve the premium UI shown in the references, you are **strictly prohibited** from using default browser UI. 

- **❌ NO `<select>` or `<option>`**: Replace with custom div-based dropdowns (using Radix UI or Headless UI) styled with the exact tokens above.
- **❌ NO `<input type="file">`**: Replace with a custom drag-and-drop zone. Hide the native input using `opacity-0 absolute` and trigger it via a custom button.
- **❌ NO `window.alert()`, `window.confirm()`, or `window.prompt()`**: Use a custom Toast notification system (e.g., Sonner) or custom modal overlays.
- **❌ NO Default Checkboxes/Radios**: Build custom SVG toggles.
- **❌ NO Default Scrollbars**: Use custom styling (`::-webkit-scrollbar`) or hide them entirely on carousels.
- **✅ Focus States**: Must use `focus-visible:ring-2 focus-visible:ring-blue-500 outline-none`.

---

## 3. Page Architecture & Layouts

### 3.1 Authentication Page (Derived from Solbot)
**Purpose:** Secure login/signup gate for Clippboard. 
**Layout:** Centered card (`authcard`), minimalistic.

- **Background:** `bg-warm-white`.
- **Brand Header:** 
  - Logo mark (SVG).
  - Brand name: `text-soft-black font-bold text-2xl` ("Clippboard").
  - Tagline: `text-muted text-sm` ("AI Video Clipping Workspace").
- **Main Title (H1):** "Sign in" (`text-[32px] font-bold text-soft-black`).
- **Notice Text:** "This workspace uses client-side rendering. Access is limited to authorised creators." (Small text, `text-gray-500`).
- **Form Elements:**
  - **Label:** "Access token" (`authlabel` - font-semibold).
  - **Input:** Password field (`authinput` - custom styled, no native border, use `rounded-lg` and `focus:ring-2 ring-blue-500`).
  - **Submit Button:** "Sign in" (`btn btn--primary` - `bg-blue-500` text `text-soft-black`).
- **Footer:** "Browser-based processing · keep tab open during export" (`text-xs text-center text-gray-400`).

### 3.2 Landing Page (Derived from Kit)
**Structure:** Follows a strict center-aligned, high-whitespace grid.

1. **Header (Sticky):**
   - Center Logo (SVG).
   - Right: "Sign In" (text link), "Start Free Trial" (Primary Button `bg-blue-500`).
2. **Hero Section:**
   - Small Kicker: `text-[18px] font-bold` ("The video platform made for creators:").
   - Massive H1: `text-[80px] leading-[0.95]` ("Turn long videos into engaging clips").
   - CTA: Large button `px-6 py-4 text-[18px] rounded-3` ("Start Clipping").
   - **Hero Image:** Wrapped in a div with `bg-warm-white`, `rounded-3`, `border-4 border-blue-200` (showing a mockup of the dashboard).
3. **Dark Features Section (`bg-soft-black text-warm-white`):**
   - Split layout: Left (Large illustration), Right (H3: "Clippboard is the video-first operating system for creators").
   - **4-Column Grid:** `grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-4`.
   - **Feature Cards:** `bg-warm-white/10 rounded-lg px-4 pt-4 lg:px-5 lg:pt-5 pb-10`.
   - **Checklists (e.g., Auto-Reframe, 4K Upscale, AI Clip Detection):** Custom checkmark SVG (`text-blue-500`), `flex flex-row gap-2`, `text-[14px]`.
4. **Social Proof Carousel:**
   - Infinite horizontal scroll (no scrollbar).
   - Circular avatars (`w-[187px] h-[187px]`).
   - Name (`text-[18px] font-semibold`), Title (`text-[14px] text-muted`).
5. **Footer (`bg-soft-black text-white`):**
   - Logo, Copyright.
   - Links: Privacy, Terms, GDPR.
   - Social Icons: Custom SVGs (`w-6 h-6`, hover: `text-blue-500`).

### 3.3 Dashboard Workspace (The Clippboard Core)
**Layout:** Sidebar + Main Content.

- **Sidebar (Left):**
  - Fixed width (`w-64`).
  - Background: `bg-warm-white`.
  - Nav links: Hover state `bg-white rounded-lg`.
- **Main Workspace:**
  - **Prompt Card:** Large text area, `rounded-2xl`, `border-gray-200`. No native resize. Placeholder: "e.g., Find the best 10 moments. Add the text 'Subscribe for more'..." 
  - **Upload Zone:** `border-2 border-dashed border-gray-300 rounded-2xl p-12`. 
    - *Drag Active:* `border-blue-500 bg-blue-500/10`.
  - **Settings Row:** 
    - Custom Dropdown 1: Aspect Ratio (9:16, 16:9).
    - Custom Dropdown 2: Resolution (1080p, 4K).
    - Generate Button: `bg-blue-500 text-soft-black px-8 py-3 rounded-xl`.
  - **Output Gallery:** Masonry grid of video cards.
    - Thumbnail: `rounded-xl`, thick border `border-blue-200`.
    - Info: Title, Duration tag, Download button.

---

## 4. Component Library Specification

### 4.1 Primary Button
- **Class:** `font-primary tracking-[-0.14px] duration-200 font-semibold inline-flex items-center justify-center text-soft-black bg-blue-500 hover:bg-blue-200 px-4 py-3 rounded-2 xs:rounded-3 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none`
- **Behavior:** Smooth background transition on hover. Focus ring for accessibility.

### 4.2 Custom Select / Dropdown
- **Trigger:** `inline-flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:bg-warm-white`.
- **Content (Menu):** `bg-white rounded-xl shadow-xl z-50`.
- **Item:** `flex items-center px-8 py-3 hover:bg-warm-white cursor-pointer`.
- **Check Icon:** `absolute left-2 text-blue-500`.

### 4.3 Custom File Uploader
- **Default:** `border-2 border-dashed border-gray-300 rounded-2xl bg-warm-white flex flex-col items-center p-10`.
- **Drag Active:** `border-blue-500 bg-blue-500/10`.
- **Text:** "Drag & drop your raw video, or click to browse" (`text-[16px] font-semibold`).

### 4.4 Typography Notes
- **Tracking:** Use `-tracking-1` for large headings to make them tight and punchy (as seen in Kit).
- **Line Height:** Use `leading-[0.95]` for H1 and `leading-[1.25]` for card titles.
- **Opacity:** Use `text-white opacity-80` for subtle text in dark sections.

---

## 5. UX & Accessibility Rules

1. **Autofocus:** The first input field on the Auth page (`Access token`) must have the `autofocus` attribute.
2. **Autocomplete:** Set `autocomplete="off"` on sensitive forms (like Auth).
3. **ARIA Labels:** All SVG icons acting as buttons must have `aria-label` and `role="img"`.
4. **Keyboard Navigation:** The entire app must be navigable using `Tab`. 
   - Focus rings: `focus-visible:ring-2 focus-visible:ring-blue-500 outline-none` (Mandatory on all interactive elements).
5. **Loading States:** Use Skeleton loaders (pulsing gray blocks) instead of spinners when generating videos.
6. **Error Handling:** Instead of native alerts, use a Toast notification at the top-right of the screen.
7. **Processing Context:** In the Dashboard, clearly display "Browser-based processing · Keep tab open" as a status indicator, taking inspiration from Solbot's read-only warning.

---
*Document Ends.*
