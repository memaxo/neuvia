## Neuvia Frontend Guidelines

This document outlines the design principles, styling guidelines, and UI components to be used throughout the Neuvia application.  The goal is to maintain a consistent, user-friendly, and accessible experience.  These guidelines should be followed for all new components and when updating existing ones.

### 1. Design Principles

*   **Clarity and Simplicity:**  The interface should be clean, uncluttered, and easy to understand.  Prioritize essential information and actions. Avoid unnecessary visual elements.
*   **Action-Oriented:** Design should guide the user towards the next logical step.  Use clear calls to action and visual cues.
*   **Data-Driven Insights:**  Present data in a visually clear and concise manner, emphasizing key findings and actionable insights.
*   **Consistency:**  Maintain consistent use of colors, typography, spacing, and components throughout the application.
*   **Accessibility:** Adhere to WCAG guidelines to ensure the application is usable by people with disabilities. This includes proper color contrast, semantic HTML, keyboard navigation, and ARIA attributes.
*   **Responsiveness:** The application should be fully responsive and work well on all screen sizes (desktop, tablet, mobile).
*   **Trust and Transparency:** Given the sensitive nature of medical data, the design should inspire trust.  Clearly indicate data sources and the reasoning behind AI-generated insights.
*   **Efficiency:**  The application should be fast and responsive. Optimize for performance, minimizing loading times and unnecessary animations.

### 2. Styling

#### 2.1. Framework: Tailwind CSS

-   We will use **Tailwind CSS** as the primary styling framework.  Leverage Tailwind's utility classes whenever possible.
-   Use the `cn` utility function (from `lib/utils.ts`) to conditionally apply Tailwind classes.
-   Use `tailwind-merge` to avoid conflicting Tailwind classes.
-   Avoid custom CSS whenever a Tailwind utility or a pre-built component (Shadcn-UI) can achieve the same result.

#### 2.2. Theme

-   The application supports both **light** and **dark** themes, managed by `next-themes`.
-   The `tailwind.config.js` file defines the color palette and other theme-related configurations.
-   The `globals.css` defines base styles and CSS variables for the color palette.
-   Use CSS variables (e.g., `var(--background)`, `var(--primary)`) for colors to ensure theme consistency.
-  **Custom Colors:** Added a custom `spline` color in the tailwind config for Spline animations.

#### 2.3. Color Palette

The `tailwind.config.js` and `globals.css` file define the color palette.  Here's a summary and intended usage:

| Color Variable                 | Light Mode (HSL)    | Dark Mode (HSL)    | Usage                                                                           |
| ------------------------------ | ------------------- | ------------------- | ------------------------------------------------------------------------------- |
| `--background`                 | `0 0% 0%`     | `0 0% 0%`     | Page background                                                                 |
| `--foreground`                 | `0 0% 100%`     | `0 0% 100%`  | Primary text color                                                              |
| `--card`                       | `0 0% 0%`     | `0 0% 0%`  | Card background                                                                 |
| `--card-foreground`            | `0 0% 100%`   | `0 0% 100%`     | Text color within cards                                                          |
| `--popover`                    | `0 0% 0%`     | `0 0% 0%`    | Popover/Dropdown background                                                     |
| `--popover-foreground`         | `0 0% 100%`  | `0 0% 100%`   | Text color within Popovers/Dropdowns                                         |
| `--primary`                    | `230 98% 65%`  | `230 98% 65%` | Primary brand color (buttons, links, active states)                             |
| `--primary-foreground`         | `0 0% 0%`    | `0 0% 0%`   | Text color on primary backgrounds                                                |
| `--secondary`                  | `300 100% 50%`|`300 100% 50%` | Secondary color, less prominent actions/elements                                |
| `--secondary-foreground`       | `0 0% 0%` | `0 0% 0%` | Text on secondary color. |
| `--muted`                      | `0 0% 20%`     | `0 0% 20%`     | Background for muted elements (e.g., separators, less important content)        |
| `--muted-foreground`           | `0 0% 60%` | `0 0% 60%`  | Text color for muted elements, placeholder text                                 |
| `--accent`                     | `60 100% 50%`   | `60 100% 50%`| Accent color for hover states and subtle highlights                             |
| `--accent-foreground`          | `0 0% 0%` |`0 0% 0%` | Text on accent color                                                          |
| `--destructive`                | `0 100% 50%`   | `0 100% 50%`   | Destructive actions (delete, error)                                             |
| `--destructive-foreground`     | `0 0% 100%`    | `0 0% 100%`| Text color on destructive backgrounds                                           |
| `--border`                     | `230 98% 65%` | `230 98% 65%`  | Border color                                                                    |
| `--input`                      | `230 98% 65%`   | `230 98% 65%`  | Input field background color                                                   |
| `--ring`                       | `230 98% 65%` | `230 98% 65%` | Focus ring color                                                                |
| `--chart-1` to `--chart-5`  | Various         | Various          | Colors for charts and graphs                                                     |
| `--sidebar-background`      |   `0 0% 98%`  |     `240 5.9% 10%`           | Custom for sidebar background color.     |
| `--sidebar-foreground` | `240 5.3% 26.1%` | `240 4.8% 95.9%`  | Text color for sidebar.   |

- **Gradients**: Used in `card-premium`, spline animations, buttons, and highlighted text.
    -  Spline gradients (e.g. `from-spline-cyan`, `to-spline-blue`)

#### 2.4. Typography

-   **Font Family:**
    -   `font-sans`:  `Roboto` (subsets: `latin`, weights: `400`, `500`, `700`). Defined in `lib/font.tsx`.
    -   `font-mono`: `Roboto Mono` (weights: `400`, `500`, `700`). Defined in `lib/font.tsx`.
-   **Font Sizes:** Use Tailwind's default text sizes (e.g., `text-sm`, `text-base`, `text-lg`, `text-xl`, etc.).  Avoid custom font sizes unless absolutely necessary.
-   **Font Weights:** Prefer `font-medium` and `font-bold` for headings and important text. Use `font-normal` (default) for body text.
-   **Line Height:** Use Tailwind's `leading-*` classes for line height.  `leading-tight` for headings, `leading-normal` or `leading-relaxed` for body text.
- **Text colours:** Use tailwind text colours that reference the CSS custom properties, such as `text-foreground`, `text-muted-foreground` and `text-primary`.

#### 2.5. Spacing

-   Use Tailwind's spacing scale (e.g., `p-4`, `mx-2`, `space-y-8`). This ensures consistent spacing throughout the application.
-   Prefer spacing utilities over custom margins/padding.

#### 2.6. Shadows

-   Use Tailwind's `shadow-*` classes for box shadows.
-   The `card-premium` class defines a custom shadow.
- The `buttonVariants` in button.tsx defines button shadows.

#### 2.7.  Border Radius

-   `rounded-md`:  Default border radius for most elements (buttons, cards, inputs).
-   `rounded-lg`:  Larger radius for specific elements (e.g., larger cards).
-   `rounded-full`:  For circular elements (e.g., avatars, badges).
-   `rounded-sm`:  Smaller radius.
- These are defined by Shadcn in the `tailwind.config.js` and can be overridden using the `--radius` custom property.

#### 2.8. Transitions

-   Use Tailwind's `transition-*` classes for smooth transitions.
-   `transition-colors`: For color transitions.
-   `transition-transform`: For scaling and movement transitions.
-   `duration-200` or `duration-300`: Preferred transition durations.

### 3. UI Components (Shadcn-UI + Custom)

The following Shadcn-UI components are used extensively:

-   **`Button`:**  For all buttons. Use variants (`primary`, `secondary`, `ghost`, `outline`, `link`, `destructive`) and sizes (`sm`, `md`, `lg`, `icon`) as defined in `components/ui/button.tsx`.
-   **`Input`:** For text inputs.
-   **`Textarea`:** For multi-line text inputs.
-   **`Label`:** For form labels.
-   **`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`, `FormDescription`:** For building forms with React Hook Form.
-   **`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`:** For card layouts.
-   **`Table`**: For displaying tabular data.
-   **`Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`:** For modal dialogs.
-   **`Popover`, `PopoverTrigger`, `PopoverContent`:** For popovers.
-   **`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator`:** For select dropdowns.
-   **`Checkbox`:** For checkbox inputs.
-   **`RadioGroup`**, **`RadioGroupItem`:**  For radio button groups (likely used in forms, potentially within a `Select`).
-   **`Tooltip`, `TooltipProvider`, `TooltipTrigger`, `TooltipContent`:**  For tooltips.
-   **`Separator`:** For horizontal or vertical separators.
-   **`ScrollArea`, `ScrollBar`:** For scrollable areas.
-   **`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`:** For tabbed interfaces.
-   **`Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandSeparator`, `CommandShortcut`:**  For command palettes/menus (used in the Model Selector).
-   **`Skeleton`:** For loading placeholders.
-   **`Switch`:** For toggle switches.
-   **`Menubar`, `MenubarMenu`, `MenubarTrigger`, `MenubarContent`, `MenubarItem`, `MenubarSeparator`, `MenubarLabel`, `MenubarCheckboxItem`, `MenubarRadioGroup`, `MenubarRadioItem`, `MenubarPortal`, `MenubarSubContent`, `MenubarSubTrigger`, `MenubarGroup`, `MenubarSub`, `MenubarShortcut`:** For menu bars.
-   **`Alert`, `AlertDialog`, `AlertDialogPortal`, `AlertDialogOverlay`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`:** For alerts and confirmation dialogs.
- **`Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`:** Used for drawers, side sheets.  Specifically used for the mobile navigation.

**Custom Components:**

-   **`MainNav`:** Main navigation component (likely in the header).
-   **`MobileNav`:**  Navigation for mobile screens.
-   **`ThemeToggle`:**  Button to switch between light and dark themes.
-   **`AccountForm`:**  Form for managing user account details.
-   **`AuthForm`:** Form for handling user login.
-  **`DashboardSidebar`**: Implements sidebar navigation, including collapsing behavior, and uses `SidebarMenuButton`
- **`DashboardHeader`**: The header for the dashboard pages, including a user menu.
- **`NotificationCenter`:** A component for displaying notifications, with filtering and "mark as read" functionality.
- **`PatientOverview`**: Component combining `PieChart` and `MiniCalendar`.
- **`QuickStats`**: Displays summary cards for quick statistics.
- **`RecentActivity`**: Shows a list of recent user actions.
- **`SearchBar`**: A search bar component for filtering and quick search.
- **`TechnicalText`:** A component for highlighting technical terms.
- **`SecurityBadge`:** Displays security badges.
- **`CodeViewer`**: Renders code snippets with syntax highlighting. (Placeholder)
-  **`FileUploader`**: Custom file uploader component, built on top of `react-dropzone`, handles file uploads, validation, and progress display.
- **`FormStep`, `FormWrapper`**: Used for multi-step forms (like sign-up/onboarding).

### 4. Icons

-   **Lucide React:** The primary icon library (`lucide-react`).  Use the `Icons` object (from `components/icons.tsx`) to access icons consistently.
-   **Radix UI Icons:**  Used within some Radix UI components (e.g., `CheckIcon`, `CaretSortIcon`).
- **React-icons:** Used to supply social media icons.

### 5. State Management

-   **React Context:** Used for simple, local state management (e.g., `SidebarContext` in `components/ui/sidebar.tsx`).
-   **React Hook Form:**  For form state management.
-   **React Query:**  For data fetching and caching.
-   **useState, useReducer, useEffect, useCallback, useMemo, useRef, useLayoutEffect:** Standard React hooks are used extensively for component-level state and side effects.

### 6. Routing

-   **Next.js App Router:**  File-based routing using the `app/` directory.
- Dynamic routes used for individual patient pages (e.g., `/dashboard/patients/[id]`).

### 7. API Interaction

-   **Supabase Client:** Used to interact with the Supabase backend (database, authentication, storage).
-   **Server Actions (Next.js):** Used for server-side logic and data mutations.

### 8.  Accessibility (a11y)

-   **Semantic HTML:** Use appropriate HTML elements (e.g., `<nav>`, `<header>`, `<footer>`, `<button>`, `<input>`).
-   **ARIA Attributes:** Use ARIA attributes where necessary to enhance screen reader compatibility (e.g., `aria-label`, `aria-describedby`, `role`). Many Radix UI components handle this automatically.
-   **Keyboard Navigation:** Ensure all interactive elements are accessible via keyboard navigation.
-   **Color Contrast:** Maintain sufficient color contrast between text and background.
-   **Focus Management:** Use `focus-visible` styles to clearly indicate focused elements.

### 9.  Code Style and Conventions

-   **TypeScript:**  Use strict type checking.
-   **ESLint:**  Enforce consistent code style and catch potential errors.
-   **Prettier:**  Automatically format code.
-   **Comments:**  Add clear and concise comments to explain complex logic.
-   **Component Structure:** Follow a consistent component structure (props, state, effects, JSX).
-   **Naming Conventions:**
    -   Components: PascalCase (e.g., `PatientList`).
    -   Variables and functions: camelCase (e.g., `patientData`).
    -   Constants: UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`).
    -   CSS Classes: BEM-like naming with Tailwind (e.g., `patient-list__item`, `card-premium-header`).

### 10. Testing
- Jest and React Testing Library (configured, but no tests are shown in this code). Tests are defined in the `package.json` scripts.

