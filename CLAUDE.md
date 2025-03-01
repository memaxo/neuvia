# Neuvia App Development Guide

## Build and Development Commands
- 🚀 `pnpm dev` - Start development server with debugging
- 🔨 `pnpm build` - Build for production
- 🧪 `pnpm test` - Run all tests
- 🧪 `pnpm test -- -t "test name"` - Run specific test
- 🔍 `pnpm lint` - Check for lint issues
- 🔧 `pnpm lint:fix` - Fix lint issues automatically
- 🧾 `pnpm type-check` - Check TypeScript types
- ✨ `pnpm format` - Format code with Prettier
- 💾 `pnpm db:start` - Start local Supabase database

## Code Style Guidelines
- TypeScript with strict typing and proper error handling
- NextJS 15 App Router architecture
- React components: PascalCase
- Variables/functions: camelCase
- Constants: UPPER_SNAKE_CASE
- Follow ESLint rules (extending next/core-web-vitals)
- Format with Prettier (single quotes, no semi)
- Import order: React → Next → Third-party → Internal (see prettier.config.js)
- Use Tailwind CSS with custom color palette
- Leverage Shadcn UI components (see components/ui)
- Handle async errors with try/catch
- Follow accessibility standards (WCAG)
- Create proper prop interfaces for components

## Project Structure
- App router in `app/` directory
- Reusable UI in `components/`
- Utils and helpers in `lib/`
- Custom hooks in `hooks/`
- Context providers in `contexts/`
- Configuration in `config/`