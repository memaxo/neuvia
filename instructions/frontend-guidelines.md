# Neuvia Frontend Guidelines

This document describes the design and UI implementation standards for Neuvia’s medical AI application. By following these guidelines, we ensure our product remains user-friendly, accessible, and visually cohesive—instilling trust in patients, clinicians, and other stakeholders. Each section references best practices drawn from both our existing system and insights gleaned from studying Geist UI.

---

## 1. Core Design Principles

1. **Clarity & Simplicity**  
   - Present interfaces that are clean and clutter-free, allowing users to focus on critical medical data and next steps.  
   - Align with healthcare best practices by making forms, dashboards, and alerts immediately understandable.

2. **Consistency**  
   - Enforce uniform styles (colors, typography, components) to reduce cognitive load.  
   - Reuse established design tokens and component patterns rather than introducing new ones.

3. **Trust & Professionalism**  
   - Convey reliability and expertise by using a clear visual hierarchy, subtle animations, and calm color tones (e.g., brand blues/teals).  
   - Place emphasis on clarity over decoration; in healthcare, an overly ornamental interface can hinder trust.

4. **Accessibility (A11y)**  
   - Build every screen and component to meet or exceed WCAG 2.1 AA guidelines.  
   - Ensure sufficient color contrast, keyboard navigation, semantic HTML, and descriptive labeling/ARIA.

5. **Responsiveness & Scalability**  
   - Employ a responsive grid system and flexible layout utilities to adapt seamlessly across devices (desktop, tablet, mobile).  
   - Keep spacing and breakpoints consistent so that content remains organized and legible on any screen size.

6. **Efficiency & Speed**  
   - Strive for fast load times and minimize any performance drag, especially as clinicians rely on the app in real time.  
   - Keep animations subtle and short (typically under 300ms) so the interface feels responsive rather than distracting.

7. **Transparency & Data Integrity**  
   - Clearly communicate data sources and how AI-generated insights are derived.  
   - Avoid design “dark patterns” that might confuse or trick users—especially important in medical contexts.

---

## 2. Styling & Framework Conventions

We use **Tailwind CSS** as the foundational styling engine, supplemented by custom tokens and a semantic color approach. Many guidelines here mirror the structured approach of Geist UI—where color roles, typography scales, spacing, and accessible interactions are defined globally and reused consistently.

### 2.1 Framework

- **Tailwind CSS**: Leverage utility classes for layout, spacing, and color.  
- **Shadcn-UI**: For prebuilt components (buttons, dialogs, etc.) that match our theme.  
- **Avoid custom CSS** when a Tailwind utility or an existing component can achieve the same effect.  
- **`cn` Utility**: Use `cn()` from `lib/utils.ts` to combine classes and `tailwind-merge` to reconcile any conflicts.

### 2.2 Theme & Color System

Neuvia employs a **semantic color framework** similar to Geist’s high-contrast, roles-based approach. Each color variable has a defined purpose—e.g., `primary` for main actions, `success` for positive alerts—ensuring consistency and accessibility.

- **Light & Dark Modes**  
  - Implemented via [`next-themes`](https://github.com/pacocoursey/next-themes).  
  - Color variables (`--background`, `--primary`, etc.) update based on the active theme.  
  - Smooth transitions between light/dark modes use `transition-colors` and `duration-300`.

- **Color Variables**  
  Each color below is stored as an RGB triple for easy manipulation with opacities in Tailwind (e.g., `bg-[rgb(var(--primary))/0.1]`).

  | **Variable**         | **Purpose**        | **Dark Mode**        | **Light Mode**        |
  |----------------------|--------------------|----------------------|-----------------------|
  | `--background`       | Main background    | `5 5 5` (≈#050505)   | `247 250 252` (≈#F7FAFC)  |
  | `--foreground`       | Primary text       | `255 255 255` (≈#FFF)| `26 32 44` (≈#1A202C)     |
  | `--border`           | Border color       | `38 38 38` (≈#262626)| `226 232 240` (≈#E2E8F0) |
  | `--primary`          | Brand teal (CTA)   | `0 132 124` (≈#00847C) | `0 107 103` (≈#006B67) |
  | `--success`          | Success feedback   | `76 175 80` (≈#4CAF50) | `56 142 60` (≈#388E3C) |
  | `--warning`          | Warning alerts     | `255 160 0` (≈#FFA000)| `245 124 0` (≈#F57C00) |
  | `--error`            | Error states       | `229 62 62` (≈#E53E3E)| `197 48 48` (≈#C53030) |
  | `--neutral-*`        | Grayscale palette  | Varies per step       | Varies per step       |

- **Usage Guidelines**  
  - **Primary Buttons**: `bg-[rgb(var(--primary))]`  
  - **Hover State**: Shift to `--primary-light` or `--primary-dark` for hover/active.  
  - **Status Indicators**: `--success`, `--warning`, `--error` used for icons, text, or backgrounds.  
  - **Accents**: `--secondary` is a tech-blue accent for secondary actions (e.g., side buttons, links).

- **WCAG Contrast Compliance**  
  - All text on backgrounds uses color pairs that meet **4.5:1** contrast ratio.  
  - Check each new color usage with automated contrast tools before merging.

### 2.3 Typography

Inspired by Geist’s consistent typography scales, we define **clear text styles** to reinforce hierarchy and legibility.

- **Font Families**  
  - **Sans:** `Roboto` (weights: 400, 500, 700)  
  - **Mono:** `Roboto Mono` (for code snippets or specialized data)  

- **Font Sizes & Weights**  
  - Follow Tailwind’s default size scale (`text-base`, `text-sm`, `text-xl`, etc.)  
  - Headings: Typically `font-bold` with `.leading-tight`  
  - Body Text: `font-normal` (400) or `font-medium` (500) with `.leading-normal` or `.leading-relaxed`

- **Accessibility**  
  - **Minimum 16px** for body text to aid readability for older or low-vision users.  
  - Maintain ample line spacing (`leading-relaxed`) for large blocks of text.

- **Consistency**  
  - Use a small set of heading sizes (e.g., `text-2xl`, `text-xl`, `text-lg`) to avoid scattering font scales across the UI.  
  - Avoid custom inline font sizes unless absolutely needed—stick to defined Tailwind sizes.

### 2.4 Spacing & Grid Layout

A structured spacing and grid system—similar to Swiss-inspired Geist—ensures the UI remains balanced and easy to scan.

- **Spacing**  
  - Use Tailwind’s **4px-based** scale (e.g., `p-4`, `m-6`, `gap-8`).  
  - Keep spacing purposeful; avoid arbitrary increments.

- **Layout**  
  - **Grid**: Use Tailwind’s grid utilities for multi-column layouts (e.g., `grid-cols-2`, `grid-cols-3`).  
  - **Flexbox**: For simpler row/column alignments (e.g., navbars, footers).  
  - Document standard layout patterns—like a two-column form on desktop that collapses to single-column on mobile (`md:grid-cols-2` → `grid-cols-1`).

- **Responsive Breakpoints**  
  - **sm (≥640px)**, **md (≥768px)**, **lg (≥1024px)**, **xl (≥1280px)**, **2xl (≥1536px)**  
  - Start mobile-first, layering on complexity as the screen gets larger.

### 2.5 Shadows & Radius

- **Shadows**  
  - Use `shadow-sm`, `shadow-md`, `shadow-lg` from Tailwind.  
  - Keep it subtle (especially for modals, cards) to maintain a polished, professional look.

- **Border Radius**  
  - Standard radius: `rounded-md` or `rounded-lg`.  
  - Full circles: `rounded-full` (avatars, badges).  
  - Consistent corner rounding helps unify the UI.

### 2.6 Motion & Transitions

Following a Geist-like principle of _“subtle, purposeful motion”_:

- **Transition Durations**: Typically `200ms` or `300ms` (`duration-200`, `duration-300`).  
- **Easing**: Prefer `ease-in-out`.  
- **Focus States**: Appear instantly (no delay).  
- **Hover States**: Slight color shift or scale, but minimal so as not to distract.

### 2.7 Accessibility

In a medical context, **accessibility is non-negotiable**. We mirror Geist’s emphasis on high-contrast colors and thorough a11y checks:

- **Color Contrast**: Verified to meet WCAG AA (4.5:1).  
- **Keyboard Navigation**: Ensure all interactive elements are focusable and have visible focus indicators (`outline-none focus:ring-*`).  
- **Screen Readers**: Use semantic HTML and ARIA attributes where needed. Provide descriptive alt text or aria-labels for icons.  
- **No Color-Only Indicators**: Always pair color changes with icons/text messages for status feedback.

---

## 3. UI Components

We rely on **Shadcn-UI** as a flexible, accessible baseline. Each component adheres to the same tokens for color, spacing, border radius, etc. This approach ensures uniformity, comparable to how Geist unifies all of Vercel’s products.

### 3.1 Shared Patterns

- **Buttons**  
  - Variants: `primary`, `secondary`, `ghost`, `outline`, etc.  
  - Must have consistent hover/active states using `--primary-light` or `--primary-dark`.  
  - Keep text large enough (≥14px) and high-contrast for readability.

- **Forms**  
  - Use `react-hook-form` plus Shadcn-UI form primitives.  
  - Provide clear error states with red outlines, icons, and messages.  
  - Group related fields in columns or grids, ensuring enough spacing.

- **Cards**  
  - Keep them minimal, with a background using `bg-[rgb(var(--background))/var(--opacity-40)]` or a neutral color.  
  - Titles and actions inside each card should be consistently spaced, typically `p-6`.

- **Dialogs, Popovers, Sheets**  
  - Provide focus trapping, straightforward close actions, and descriptive headings.  
  - Use transitions for open/close in `200–300ms` range.

- **Tables**  
  - Text aligned left unless numeric.  
  - Distinguishable row hover states.  
  - Accessible markup with `<thead>`, `<tbody>`, `<th scope="col">`, `<tr>`, etc.

### 3.2 Custom Components

- **`PatientOverview`, `QuickStats`, `RecentActivity`**  
  - Domain-specific modules that follow the same spacing, color, and typography rules.  
  - Present data clearly, using high-contrast text and minimal decoration.

- **`DashboardSidebar`**  
  - Displays a vertical nav. Collapsible sections must remain keyboard-accessible.  
  - Use brand color highlights on hover or active states.

- **`MobileNav`**  
  - Implements a “sheet” pattern for smaller screens.  
  - Trigger button is always visible and labeled (e.g., “Open menu”).

- **`FileUploader`**, **`CodeViewer`**  
  - Consistent color usage for interactive states (drag-over, success, error).  
  - Provide accessible labels and instructions for users.

---

## 4. Layout Structures & Examples

### 4.1 Base Page Layout

```tsx
<div className="flex min-h-screen flex-col bg-[rgb(var(--background))] text-[rgb(var(--foreground))]">
  <Header />
  <main className="flex-1 p-4 md:p-6">
    {/* Page Content */}
  </main>
  <Footer />
</div>
```

### 4.2 Dashboard Layout

```tsx
<div className="flex min-h-[calc(100vh-3.5rem)]">
  {/* Sidebar */}
  <aside className="hidden w-72 border-r border-[rgb(var(--border))] xl:block">
    <DashboardSidebar />
  </aside>

  {/* Main Content */}
  <section className="flex-1 p-6 space-y-6">
    <DashboardHeader />
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Cards / Stats / Charts */}
    </div>
  </section>
</div>
```

### 4.3 Responsive Form

```tsx
<form className="space-y-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <Label htmlFor="firstName">First Name</Label>
      <Input id="firstName" name="firstName" />
    </div>
    <div>
      <Label htmlFor="lastName">Last Name</Label>
      <Input id="lastName" name="lastName" />
    </div>
  </div>
  
  <div>
    <Label htmlFor="notes">Notes</Label>
    <Textarea id="notes" name="notes" />
  </div>
  
  <Button variant="primary">Submit</Button>
</form>
```

---

## 5. State & Data Handling

- **React Context**: For managing shared UI states (e.g., theme toggles, mobile nav).  
- **React Hook Form**: For form validation and submission, ensuring consistent error handling.  
- **React Query**: For server data caching (patient records, analytics, etc.).  
- **Supabase**: Auth, database, and file storage interactions.

Ensure each data-driven component uses consistent loading states—e.g., a `Skeleton` for placeholders or a subtle `Spinner`.

---

## 6. Accessibility (Deep Dive)

Following healthcare design standards, we go above and beyond baseline a11y:

1. **Visible Focus**  
   - Use Tailwind’s `focus:ring-2` or a custom outline that stands out.  
   - Keyboard tabbing order matches reading order.

2. **Screen Reader Support**  
   - Provide alt text for icons or images (especially in data visualizations).  
   - Label form fields explicitly—e.g., `<label htmlFor="field" />`.

3. **Robust Color Contrast**  
   - All text on background meets or exceeds 4.5:1 contrast ratio.  
   - Status color signals (e.g., errors) combined with icons or text labels.

4. **Responsive Text**  
   - Use relative units (`rem`) so users can scale text if needed.  
   - No fixed pixel fonts for critical content.

5. **ARIA Roles**  
   - For complex components (Tabs, Dialogs, Accordions), rely on well-tested Shadcn-UI + Radix to handle ARIA attributes.

---

## 7. Code Conventions & Testing

- **TypeScript**: Strict mode to catch errors early.  
- **ESLint & Prettier**: Enforce consistent formatting and best practices.  
- **Naming**:  
  - Components in **PascalCase** (e.g., `PatientForm`),  
  - Props/variables in **camelCase** (e.g., `patientCount`),  
  - Constants in **UPPER_SNAKE_CASE** (e.g., `MAX_FILE_SIZE`).

- **Unit/Integration Tests**  
  - **Jest** and **React Testing Library** for components (especially forms, modals).  
  - Perform **accessibility checks** (e.g., with `@testing-library/jest-dom` and `axe`).  
  - Focus on critical paths (patient data forms, sign-in flow, vital chart displays).

---

## 8. Ongoing Evolution

Just like Vercel’s Geist system evolves, Neuvia’s design system remains a _living_ resource:

- **Documentation Updates**: Whenever we create or modify a component, we add usage notes and code samples to our internal Wiki or Storybook.  
- **Design Reviews**: All new features undergo a design review against these guidelines. We specifically watch for color, typography, spacing, and a11y deviations.  
- **Accessibility Audits**: Periodic audits with real users—including those with assistive devices—ensure that we continually meet (or surpass) accessibility standards.  
- **Feedback Loop**: Encourage all team members to share feedback if something breaks consistency or confuses users—healthcare apps must remain transparent and easy to navigate.

---

## Conclusion

By uniting **clarity, consistency, trust,** and **accessibility**—inspired by the structured methods of Geist UI—Neuvia’s frontend design system provides a stable, professional, and empathetic experience for healthcare users. Every detail, from color roles to form error messages, is carefully considered to uphold Neuvia’s reputation as a reliable medical AI platform. As we expand with new features and integrations, these guidelines ensure all additions feel cohesive and continue to instill user confidence in our product.

> **Remember**: The point of a design system is not just style—it’s about enabling teams to build experiences that users can depend on, especially in sensitive contexts like healthcare. Follow these guidelines diligently, and don’t hesitate to propose improvements that keep Neuvia’s UI evolving toward even greater clarity, accessibility, and trust.