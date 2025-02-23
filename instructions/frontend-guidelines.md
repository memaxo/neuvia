## Neuvia Frontend Guidelines

This document outlines the design principles, styling guidelines, and UI components to be used throughout the Neuvia application. The goal is to maintain a consistent, user-friendly, and accessible experience. These guidelines should be followed for all new components and when updating existing ones.

### 1. Design Principles

- **Clarity and Simplicity:** The interface should be clean, uncluttered, and easy to understand. Prioritize essential information and actions. Avoid unnecessary visual elements.
- **Action-Oriented:** Design should guide the user towards the next logical step. Use clear calls to action and visual cues.
- **Data-Driven Insights:** Present data in a visually clear and concise manner, emphasizing key findings and actionable insights.
- **Consistency:** Maintain consistent use of colors, typography, spacing, and components throughout the application.
- **Accessibility:** Adhere to WCAG guidelines to ensure the application is usable by people with disabilities. This includes proper color contrast, semantic HTML, keyboard navigation, and ARIA attributes.
- **Responsiveness:** The application should be fully responsive and work well on all screen sizes (desktop, tablet, mobile).
- **Trust and Transparency:** Given the sensitive nature of medical data, the design should inspire trust. Clearly indicate data sources and the reasoning behind AI-generated insights.
- **Efficiency:** The application should be fast and responsive. Optimize for performance, minimizing loading times and unnecessary animations.

### 2. Styling

#### 2.1. Framework: Tailwind CSS

- We will use **Tailwind CSS** as the primary styling framework. Leverage Tailwind's utility classes whenever possible.
- Use the `cn` utility function (from `lib/utils.ts`) to conditionally apply Tailwind classes.
- Use `tailwind-merge` to avoid conflicting Tailwind classes.
- Avoid custom CSS whenever a Tailwind utility or a pre-built component (Shadcn-UI) can achieve the same result.

#### 2.2. Theme

- The application supports both **light** and **dark** themes, managed by `next-themes`.
- The `tailwind.config.js` file defines the color palette and other theme-related configurations.
- The `globals.css` defines base styles and CSS variables for the color palette.
- Use CSS variables (e.g., `var(--background)`, `var(--primary)`) for colors to ensure theme consistency.
- **Custom Colors:** Added a custom `spline` color in the tailwind config for Spline animations.

#### 2.3. Color Palette

The application uses a medical AI-focused color system that adapts between dark and light modes. Colors are defined as RGB values in CSS variables and accessed through Tailwind's RGB color syntax.

**Base Colors:**
| Color Variable    | Dark Mode         | Light Mode        | Usage                                          |
| ---------------- | ----------------- | ----------------- | ---------------------------------------------- |
| `--background`   | `5 5 5`          | `247 250 252`    | Main background (#050505 / #F7FAFC)            |
| `--foreground`   | `255 255 255`    | `26 32 44`       | Primary text (#FFFFFF / #1A202C)               |
| `--border`       | `38 38 38`       | `226 232 240`    | Border color (#262626 / #E2E8F0)               |

**Primary Colors (Medical Teal):**
| Color Variable    | Dark Mode         | Light Mode        | Usage                                          |
| ---------------- | ----------------- | ----------------- | ---------------------------------------------- |
| `--primary`      | `0 132 124`      | `0 107 103`      | Primary actions (#00847C / #006B67)            |
| `--primary-light`| `65 191 179`     | `0 132 124`      | Hover states (#41BFB3 / #00847C)               |
| `--primary-dark` | `0 107 103`      | `0 87 84`        | Active states (#006B67 / #005754)              |

**Secondary Colors (Tech Blue):**
| Color Variable      | Dark Mode         | Light Mode        | Usage                                          |
| ------------------ | ----------------- | ----------------- | ---------------------------------------------- |
| `--secondary`      | `74 144 226`     | `44 82 130`      | Secondary actions (#4A90E2 / #2C5282)          |
| `--secondary-light`| `98 162 237`     | `74 144 226`     | Hover states (#62A2ED / #4A90E2)               |
| `--secondary-dark` | `44 82 130`      | `26 54 93`       | Active states (#2C5282 / #1A365D)              |

**Status Colors:**
| Color Variable    | Dark Mode         | Light Mode        | Usage                                          |
| ---------------- | ----------------- | ----------------- | ---------------------------------------------- |
| `--success`      | `76 175 80`      | `56 142 60`      | Success states (#4CAF50 / #388E3C)             |
| `--warning`      | `255 160 0`      | `245 124 0`      | Warning states (#FFA000 / #F57C00)             |
| `--error`        | `229 62 62`      | `197 48 48`      | Error states (#E53E3E / #C53030)               |

**Neutral Scale:**
| Color Variable    | Dark Mode         | Light Mode        | Usage                                          |
| ---------------- | ----------------- | ----------------- | ---------------------------------------------- |
| `--neutral-100`  | `247 250 252`    | `26 32 44`       | Lightest/Darkest (#F7FAFC / #1A202C)           |
| `--neutral-200`  | `226 232 240`    | `45 55 72`       | Very light/dark (#E2E8F0 / #2D3748)            |
| `--neutral-300`  | `203 213 224`    | `113 128 150`    | Light/dark (#CBD5E0 / #718096)                 |
| `--neutral-400`  | `113 128 150`    | `203 213 224`    | Mid tone (#718096 / #CBD5E0)                   |
| `--neutral-500`  | `45 55 72`       | `226 232 240`    | Dark/light (#2D3748 / #E2E8F0)                 |
| `--neutral-600`  | `26 32 44`       | `247 250 252`    | Darkest/Lightest (#1A202C / #F7FAFC)           |

**Usage Guidelines:**

1. **Component Colors:**
   - Use `bg-[rgb(var(--background))]` for main backgrounds
   - Use `text-[rgb(var(--foreground))]` for primary text
   - Use `border-[rgb(var(--border))]` for borders
   - Use opacity variants with `/var(--opacity-*)` for different opacities

2. **Interactive Elements:**
   - Primary buttons: `bg-[rgb(var(--primary))]`
   - Secondary buttons: `bg-[rgb(var(--secondary))]`
   - Hover states: Use `*-light` variants
   - Active states: Use `*-dark` variants

3. **Status Indicators:**
   - Success messages/icons: `text-[rgb(var(--success))]`
   - Warning alerts: `text-[rgb(var(--warning))]`
   - Error messages: `text-[rgb(var(--error))]`
   - Background variants: Use with opacity, e.g., `bg-[rgb(var(--success))/0.1]`

4. **UI Elements:**
   - Cards: Use neutral scale with appropriate opacity
   - Text hierarchy: Use neutral scale for different text importance levels
   - Borders: Use border color with opacity variations

5. **Accessibility:**
   - All color combinations meet WCAG 2.1 AA standards for contrast
   - Status colors are designed to be distinguishable for color-blind users
   - Use opacity values to maintain readability while creating visual hierarchy

6. **Theme Transitions:**
   - Colors transition smoothly between modes using CSS transitions
   - Use `duration-normal` (300ms) for color transitions
   - Some components may use custom transition timing

**Example Usage:**
```tsx
<div className="bg-[rgb(var(--background))]">
  <h1 className="text-[rgb(var(--foreground))]">Title</h1>
  <button className="bg-[rgb(var(--primary))] hover:bg-[rgb(var(--primary-light))]">
    Action
  </button>
  <div className="border-[rgb(var(--border))/var(--opacity-10)]">
    Content
  </div>
</div>
```

#### 2.4. Typography

- **Font Family:**
  - `font-sans`: `Roboto` (subsets: `latin`, weights: `400`, `500`, `700`). Defined in `lib/font.tsx`.
  - `font-mono`: `Roboto Mono` (weights: `400`, `500`, `700`). Defined in `lib/font.tsx`.
- **Font Sizes:** Use Tailwind's default text sizes (e.g., `text-sm`, `text-base`, `text-lg`, `text-xl`, etc.). Avoid custom font sizes unless absolutely necessary.
- **Font Weights:** Prefer `font-medium` and `font-bold` for headings and important text. Use `font-normal` (default) for body text.
- **Line Height:** Use Tailwind's `leading-*` classes for line height. `leading-tight` for headings, `leading-normal` or `leading-relaxed` for body text.
- **Text colours:** Use tailwind text colours that reference the CSS custom properties, such as `text-foreground`, `text-muted-foreground` and `text-primary`.

#### 2.5. Spacing

- Use Tailwind's spacing scale (e.g., `p-4`, `mx-2`, `space-y-8`). This ensures consistent spacing throughout the application.
- Prefer spacing utilities over custom margins/padding.

#### 2.6. Shadows

- Use Tailwind's `shadow-*` classes for box shadows.
- The `card-premium` class defines a custom shadow.
- The `buttonVariants` in button.tsx defines button shadows.

#### 2.7. Border Radius

- `rounded-md`: Default border radius for most elements (buttons, cards, inputs).
- `rounded-lg`: Larger radius for specific elements (e.g., larger cards).
- `rounded-full`: For circular elements (e.g., avatars, badges).
- `rounded-sm`: Smaller radius.
- These are defined by Shadcn in the `tailwind.config.js` and can be overridden using the `--radius` custom property.

#### 2.8. Transitions

- Use Tailwind's `transition-*` classes for smooth transitions.
- `transition-colors`: For color transitions.
- `transition-transform`: For scaling and movement transitions.
- `duration-200` or `duration-300`: Preferred transition durations.

#### 2.9. Grid System

The application uses a consistent grid system based on Tailwind's flexbox and grid utilities. This system ensures responsive, maintainable, and accessible layouts.

##### Core Concepts

1. **Base Layout Structure**
```tsx
// Root layout - Full height with header
<div className="flex min-h-screen flex-col">
  <header />
  <main className="flex-1" />
  <footer />
</div>

// Dashboard layout - Accounts for header height
<div className="flex min-h-[calc(100vh-3.5rem)]">
  <aside /> {/* Sidebar */}
  <main className="flex-1" /> {/* Main content */}
</div>
```

2. **Content Areas**
```tsx
// Standard content wrapper
<div className="relative flex-1">
  {/* Background with shadow */}
  <div className="absolute inset-0 bg-[rgb(var(--background))] shadow-2xl" />
  
  {/* Content stack */}
  <div className="relative space-y-6 p-6">
    {/* Content cards */}
  </div>
</div>
```

##### Grid Patterns

1. **Card Grid**
```tsx
// Basic card grid - Responsive columns
<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
  {cards.map(card => (
    <div key={card.id} className="card-wrapper">
      {/* Card content */}
    </div>
  ))}
</div>
```

2. **Dashboard Grid**
```tsx
// Main content + sidebar layout
<div className="flex">
  {/* Main content */}
  <div className="relative flex-1 space-y-6 p-6">
    <div className="grid gap-6">
      <section>{/* Stats */}</section>
      <section>{/* Charts */}</section>
    </div>
  </div>

  {/* Sidebar - Hidden on mobile */}
  <aside className="hidden w-[320px] border-l border-[rgb(var(--border))/var(--opacity-10)] xl:block">
    <div className="p-6">
      {/* Sidebar content */}
    </div>
  </aside>
</div>
```

3. **Form Grid**
```tsx
// Responsive two-column form
<form className="space-y-6">
  {/* Full-width fields */}
  <div className="w-full">
    <Input />
  </div>

  {/* Two-column fields */}
  <div className="grid gap-6 md:grid-cols-2">
    <Input />
    <Input />
  </div>
</form>
```

##### Component Classes

1. **Card Wrapper**
```tsx
const cardClasses = cn(
  // Base styles
  "relative overflow-hidden rounded-xl",
  // Border and background
  "border border-[rgb(var(--border))/var(--opacity-10)]",
  "bg-[rgb(var(--background))/var(--opacity-40)]",
  // Effects
  "backdrop-blur-sm"
)
```

2. **Grid Container**
```tsx
const gridClasses = cn(
  // Base grid
  "grid",
  // Responsive columns
  "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  // Spacing
  "gap-6"
)
```

##### Spacing System

| Type              | Class            | Usage                          |
|-------------------|------------------|--------------------------------|
| Section Spacing   | `space-y-6`      | Between major sections         |
| Grid Gaps        | `gap-6`          | Between grid items             |
| Card Padding     | `p-6`            | Inside cards and containers    |
| Component Gaps   | `gap-4`          | Between related elements       |

##### Breakpoint System

| Breakpoint | Class Prefix | Width  | Usage                          |
|------------|-------------|--------|--------------------------------|
| Default    | (none)      | 0px    | Mobile-first base layout       |
| Small      | `sm:`      | 640px  | Minor layout adjustments       |
| Medium     | `md:`      | 768px  | Two-column grids begin         |
| Large      | `lg:`      | 1024px | Three-column grids             |
| Extra Large| `xl:`      | 1280px | Sidebar visibility             |
| 2XL        | `2xl:`     | 1536px | Maximum width constraints      |

##### Best Practices

1. **Layout Structure**
   - Use semantic HTML elements (`<main>`, `<aside>`, `<section>`)
   - Maintain a clear visual hierarchy
   - Keep nesting levels minimal

2. **Responsive Design**
   ```tsx
   // Prefer this:
   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
   
   // Over this:
   <div className="grid grid-cols-3 lg:grid-cols-2 md:grid-cols-1">
   ```

3. **Performance**
   - Use CSS Grid for complex layouts
   - Use Flexbox for simple alignments
   - Implement virtualization for long lists
   ```tsx
   // Example with virtualization
   <VirtualizedGrid
     itemCount={items.length}
     itemSize={200}
     className={gridClasses}
   >
     {/* Grid items */}
   </VirtualizedGrid>
   ```

4. **Accessibility**
   - Maintain logical source order
   - Use appropriate ARIA landmarks
   - Ensure keyboard navigation works in grid layouts
   ```tsx
   <main role="main">
     <nav role="navigation">{/* ... */}</nav>
     <div role="grid" aria-label="Patient list">
       {/* Grid content */}
     </div>
   </main>
   ```

##### Common Patterns

1. **Content + Sidebar**
```tsx
<div className="flex">
  {/* Content */}
  <main className="flex-1 p-6">
    <div className="space-y-6">
      {/* Main content */}
    </div>
  </main>

  {/* Sidebar */}
  <aside className="hidden w-[320px] xl:block">
    {/* Sidebar content */}
  </aside>
</div>
```

2. **Card Layout**
```tsx
<div className="space-y-6">
  {/* Header card */}
  <header className={cardClasses}>
    <div className="flex items-center justify-between p-6">
      <h1>Title</h1>
      <Button>Action</Button>
    </div>
  </header>

  {/* Content cards */}
  <div className={gridClasses}>
    {/* Grid items */}
  </div>
</div>
```

3. **Responsive Navigation**
```tsx
<nav className="flex items-center gap-4">
  {/* Always visible */}
  <Button>Home</Button>

  {/* Responsive items */}
  <div className="hidden md:flex items-center gap-4">
    <Button>Features</Button>
    <Button>About</Button>
  </div>

  {/* Mobile menu */}
  <Sheet className="md:hidden">
    <SheetTrigger>Menu</SheetTrigger>
    <SheetContent>
      {/* Mobile navigation */}
    </SheetContent>
  </Sheet>
</nav>
```

### 3. UI Components (Shadcn-UI + Custom)

The following Shadcn-UI components are used extensively:

- **`Button`:** For all buttons. Use variants (`primary`, `secondary`, `ghost`, `outline`, `link`, `destructive`) and sizes (`sm`, `md`, `lg`, `icon`) as defined in `components/ui/button.tsx`.
- **`Input`:** For text inputs.
- **`Textarea`:** For multi-line text inputs.
- **`Label`:** For form labels.
- **`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`, `FormDescription`:** For building forms with React Hook Form.
- **`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`:** For card layouts.
- **`Table`**: For displaying tabular data.
- **`Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`:** For modal dialogs.
- **`Popover`, `PopoverTrigger`, `PopoverContent`:** For popovers.
- **`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator`:** For select dropdowns.
- **`Checkbox`:** For checkbox inputs.
- **`RadioGroup`**, **`RadioGroupItem`:** For radio button groups (likely used in forms, potentially within a `Select`).
- **`Tooltip`, `TooltipProvider`, `TooltipTrigger`, `TooltipContent`:** For tooltips.
- **`Separator`:** For horizontal or vertical separators.
- **`ScrollArea`, `ScrollBar`:** For scrollable areas.
- **`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`:** For tabbed interfaces.
- **`Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandSeparator`, `CommandShortcut`:** For command palettes/menus (used in the Model Selector).
- **`Skeleton`:** For loading placeholders.
- **`Switch`:** For toggle switches.
- **`Menubar`, `MenubarMenu`, `MenubarTrigger`, `MenubarContent`, `MenubarItem`, `MenubarSeparator`, `MenubarLabel`, `MenubarCheckboxItem`, `MenubarRadioGroup`, `MenubarRadioItem`, `MenubarPortal`, `MenubarSubContent`, `MenubarSubTrigger`, `MenubarGroup`, `MenubarSub`, `MenubarShortcut`:** For menu bars.
- **`Alert`, `AlertDialog`, `AlertDialogPortal`, `AlertDialogOverlay`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`:** For alerts and confirmation dialogs.
- **`Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`:** Used for drawers, side sheets. Specifically used for the mobile navigation.

**Custom Components:**

- **`MainNav`:** Main navigation component (likely in the header).
- **`MobileNav`:** Navigation for mobile screens.
- **`ThemeToggle`:** Button to switch between light and dark themes.
- **`AccountForm`:** Form for managing user account details.
- **`AuthForm`:** Form for handling user login.
- **`DashboardSidebar`**: Implements sidebar navigation, including collapsing behavior, and uses `SidebarMenuButton`
- **`DashboardHeader`**: The header for the dashboard pages, including a user menu.
- **`NotificationCenter`:** A component for displaying notifications, with filtering and "mark as read" functionality.
- **`PatientOverview`**: Component combining `PieChart` and `MiniCalendar`.
- **`QuickStats`**: Displays summary cards for quick statistics.
- **`RecentActivity`**: Shows a list of recent user actions.
- **`SearchBar`**: A search bar component for filtering and quick search.
- **`TechnicalText`:** A component for highlighting technical terms.
- **`SecurityBadge`:** Displays security badges.
- **`CodeViewer`**: Renders code snippets with syntax highlighting. (Placeholder)
- **`FileUploader`**: Custom file uploader component, built on top of `react-dropzone`, handles file uploads, validation, and progress display.
- **`FormStep`, `FormWrapper`**: Used for multi-step forms (like sign-up/onboarding).

### 4. Icons

- **Lucide React:** The primary icon library (`lucide-react`). Use the `Icons` object (from `components/icons.tsx`) to access icons consistently.
- **Radix UI Icons:** Used within some Radix UI components (e.g., `CheckIcon`, `CaretSortIcon`).
- **React-icons:** Used to supply social media icons.

### 5. State Management

- **React Context:** Used for simple, local state management (e.g., `SidebarContext` in `components/ui/sidebar.tsx`).
- **React Hook Form:** For form state management.
- **React Query:** For data fetching and caching.
- **useState, useReducer, useEffect, useCallback, useMemo, useRef, useLayoutEffect:** Standard React hooks are used extensively for component-level state and side effects.

### 6. Routing

- **Next.js App Router:** File-based routing using the `app/` directory.
- Dynamic routes used for individual patient pages (e.g., `/dashboard/patients/[id]`).

### 7. API Interaction

- **Supabase Client:** Used to interact with the Supabase backend (database, authentication, storage).
- **Server Actions (Next.js):** Used for server-side logic and data mutations.

### 8. Accessibility (a11y)

- **Semantic HTML:** Use appropriate HTML elements (e.g., `<nav>`, `<header>`, `<footer>`, `<button>`, `<input>`).
- **ARIA Attributes:** Use ARIA attributes where necessary to enhance screen reader compatibility (e.g., `aria-label`, `aria-describedby`, `role`). Many Radix UI components handle this automatically.
- **Keyboard Navigation:** Ensure all interactive elements are accessible via keyboard navigation.
- **Color Contrast:** Maintain sufficient color contrast between text and background.
- **Focus Management:** Use `focus-visible` styles to clearly indicate focused elements.

### 9. Code Style and Conventions

- **TypeScript:** Use strict type checking.
- **ESLint:** Enforce consistent code style and catch potential errors.
- **Prettier:** Automatically format code.
- **Comments:** Add clear and concise comments to explain complex logic.
- **Component Structure:** Follow a consistent component structure (props, state, effects, JSX).
- **Naming Conventions:**
  - Components: PascalCase (e.g., `PatientList`).
  - Variables and functions: camelCase (e.g., `patientData`).
  - Constants: UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`).
  - CSS Classes: BEM-like naming with Tailwind (e.g., `patient-list__item`, `card-premium-header`).

### 10. Testing

- Jest and React Testing Library (configured, but no tests are shown in this code). Tests are defined in the `package.json` scripts.
