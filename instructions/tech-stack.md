## Neuvia Technical Stack Document

This document details the technical stack and dependencies used in the Neuvia Medical Records Analysis System. It is structured to provide clear information about each component, its purpose, and its version, aiding in code generation, maintenance, and understanding.

### 1. Core Technologies

- **Next.js (v15.1.7):** The primary framework for building the application. Next.js is used for server-side rendering (SSR), static site generation (SSG), routing, API routes, and overall application structure. The version suggests usage of the App Router.
- **React (v18.3.1):** The JavaScript library for building the user interface. The application uses a component-based architecture, with extensive use of functional components and hooks.
- **TypeScript (v5.5.4):** The primary programming language, providing static typing for improved code quality and maintainability.
- **Tailwind CSS (v3.3.0):** A utility-first CSS framework for styling the application. It's used extensively throughout the UI components.
- **Shadcn-UI:** A collection of pre-built, accessible UI components built on top of Radix UI and Tailwind CSS. This provides a consistent and visually appealing design system.
- **Radix UI:** A headless UI component library providing the underlying logic and accessibility features for many of the Shadcn-UI components. Specifically used for:
  - Alert Dialog
  - Avatar
  - Checkbox
  - Context Menu
  - Dialog
  - Dropdown Menu
  - Hover Card
  - Label
  - Menubar
  - Popover
  - Progress
  - Radio Group (part of form)
  - Scroll Area
  - Select
  - Separator
  - Slider
  - Switch
  - Tabs
  - Toast
  - Tooltip
- **Supabase (v2.48.1):** Provides the backend infrastructure, including:
  - **PostgreSQL Database:** The primary data store for patient records, documents, user profiles, and other application data.
  - **Authentication (Supabase Auth):** Handles user registration, login, and session management. Supports email/password and OAuth providers (Google, GitHub, Twitter).
  - **Storage (Supabase Storage):** Used for storing uploaded patient documents (PDFs, images, etc.).
  - **Realtime:** (Potentially, though not explicitly used in the current code) Could be used for real-time updates and notifications.
  - **Edge Functions** (Not used to full capability)

### 2. Data Handling and State Management

- **React Query (TanStack Query) (v5.51.9):** Manages data fetching, caching, and synchronization between the client and server. Used extensively with Supabase to interact with the database. Key files showcasing this are `app/countries/[id]/page.tsx`, `app/ssrcountries/[id]/page.tsx` and `app/ssrcountries/[id]/country.tsx`.
- **Zod (v3.24.0):** Provides schema validation for data received from forms and API responses. This ensures data integrity and helps prevent errors. Used with `react-hook-form` via `@hookform/resolvers/zod`.
- **React Hook Form (v7.49.3):** Manages form state, validation, and submission. Used in conjunction with Zod for schema-based validation.
- **useContext** Used by a custom hook, useAppForm, and useAppFormContext to provide access to react-hook-form.

### 3. UI Components & Styling

- **Tailwind CSS (v3.3.0):** Primary styling framework.
- **Shadcn-UI:** Provides pre-built components.
- **Radix UI:** Provides underlying primitives for many Shadcn-UI components.
- **Lucide React:** Icon library (used extensively throughout the UI).
- **Class Variance Authority (CVA):** Used to define reusable component variants (e.g., different button styles). Found in `components/ui/button.tsx`.
- **clsx and tailwind-merge:** Utilities for conditionally joining class names and merging Tailwind classes (`lib/utils.ts`).

### 4. Document Processing (Placeholders)

- **PDF parsing library** (To be determined, might use `pdf.js` if client-side processing is acceptable. This would require an addition to the dependencies.)
- OCR library (if needed for scanned document text extraction).
- **Document chunking will be custom.**
- LLMs: These are called out but are more of integration points:
  - `o3-mini`: Placeholders for model usage
  - `gemini flash`: Placeholders for model usage

### 5. Internationalization

- **Next-intl** (Potentially, not included in this code, but a common choice for Next.js i18n).

### 6. Asynchronous Operations & Side Effects

- **React Query:** Handles asynchronous data fetching and caching.
- **React `useTransition`:** Used for managing pending states and providing smoother UI updates, especially during form submissions (see `AuthForm.tsx`, `supa-account-form.tsx` for examples).
- **Supabase Client Libraries:**
  - `@supabase/supabase-js`: Official JavaScript client for interacting with Supabase services.
  - `@supabase/ssr`: For server-side rendering and authentication.
  - `@supabase-cache-helpers/postgrest-react-query`: Helper library to make working with react-query seamless.

### 7. Utilities and Helpers

- **date-fns (v3.3.1):** For date and time manipulation (formatting, calculations, etc.).
- **sonner**: Used for toast notifications (see `components/ui/use-toast.ts`).
- **uploadthing**: Client-side and server-side file uploads.
- **@uploadthing/react**: React components and hooks for uploadthing.

### 8. Development Tools

- **TypeScript:** For type safety.
- **ESLint:** For code linting and enforcing code style.
- **Prettier:** For code formatting.
- **Husky:** For Git hooks (pre-commit, pre-push).
- **Jest:** (Potentially) For unit and integration testing (based on the `test` scripts).
- **pnpm:** Package manager.
- **Vercel**: Used for deployment, preview deployments and serverless functions.

### 9. File Structure (Key Files and Folders)

- **`app/`:** The main application directory, following the Next.js App Router structure.
  - `account/`: Components and logic related to user account management.
    - `account-form.tsx`, `avatar.tsx`, `page.tsx`, `supa-account-form.tsx`: manage user profile
  - `api/`: Contains API routes.
    - `send/route.ts`: Sends emails using `resend`.
    - `sid/callback/route.tsx`: Supabase OAuth2 callback
  - `auth/`: Contains components and actions for user authentication.
    - `actions/index.tsx`: Server actions for signup, login, and logout.
    - `components/AuthForm.tsx`: Login form.
    - `callback/route.tsx`: Supabase OAuth callback handler.
    - `page.tsx`: Login page.
  - `auth-server-action/`: Contains actions and components related to server-side authentication.
  - `components/`: Reusable UI components.
    - `ui/`: Shadcn-UI components (extended and customized).
    - `forms/`: Custom form components and utilities.
    - `file-uploader`: A custom file uploader component.
    - `site-header.tsx`, `site-footer.tsx`: Layout components.
    - `icons.tsx`: Wrapper component for icons.
  - `config/`: Configuration files (e.g., `siteConfig`).
  - `lib/`: Utility functions and helper modules.
    - `utils.ts`: General utility functions (e.g., `cn` for conditional class names).
    - `hooks/`: Custom React hooks.
    - `supabase.ts`, `supa-server-actions.tsx`, `supabase-browser.ts`, `supa-auth-admin.tsx`, `supaone.tsx`, `supabase-server.ts`: Supabase client and server-side helper functions.
  - `middleware.ts`: Next.js middleware (for handling redirects, etc.).
  - `queries`: Contains helper functions to query the database.
  - `supabase/`: Contains Supabase-related files.
    - `migrations/`: Database migration scripts.
- **types/** Contains shared types, like the nav types
- **`public/`:** Static assets (images, fonts, etc.).

### 10. API Routes

- `/api/send`: Handles sending emails (likely using the Resend library).
- `/api/sid/callback`: Used to implement server side OAuth.

### 11. Server Actions

The project makes extensive use of Next.js Server Actions for form submissions and data mutations. Examples include:

- `signUpWithEmailAndPassword`, `loginWithEmailAndPassword`, `logout` (in `app/auth/actions/index.tsx`).
- `updateInqueries` (in `app/contact/actions/index.tsx`): Handles contact form submissions.
- `readUserSession` and `createSupbaseServerClientReadOnly` for getting the user.

### 12. Key Dependencies & Their Purposes (Detailed)

- **`@hookform/resolvers`:** Provides integration between React Hook Form and validation libraries (like Zod).
- **`@radix-ui/*`:** Headless UI components for building accessible and customizable UI elements. These are the foundation for many of the `shadcn-ui` components.
- **`@splinetool/react-spline`:** Used for the 3D animated background.
- **`@supabase/auth-helpers-nextjs`, `@supabase/auth-helpers-react`, `@supabase/ssr`, `@supabase/supabase-js`:** Supabase client libraries for different contexts (Next.js, React, server-side).
- **`@tanstack/react-query`, `@tanstack/react-query-devtools`:** Data fetching, caching, and state management for API interactions.
- **`@types/*`:** TypeScript type definitions for various libraries.
- **`autoprefixer`, `postcss`, `tailwindcss`:** Tailwind CSS and related tools for styling.
- **`class-variance-authority`:** Utility for creating typed component variants.
- **`clsx`, `tailwind-merge`:** Utilities for working with CSS class names.
- **`cmdk`:** Command menu component (used for the model selector in the playground).
- **`date-fns`:** Date manipulation library.
- **`eslint-*`:** ESLint configuration and plugins for code linting.
- **`lucide-react`:** Icon library.
- **`next-themes`:** Handles theme switching (light/dark mode).
- **`prettier`:** Code formatter.
- **`react-day-picker`:** Date picker component.
- **`react-dropzone`:** Drag-and-drop file upload component.
- **`react-hook-form`:** Form management library.
- **`react-icons`:** Used for icons
- **`resend`:** Email sending library.
- **`sonner`:** Toast notification library.
- **`uploadthing`** A service for managing uploads.
- **`zod`:** Schema validation library.
- **next-pwa:** Progressive web app support.
- **`@next/mdx`, `@mdx-js/loader`, `@mdx-js/react`:** MDX integration for Next.js
