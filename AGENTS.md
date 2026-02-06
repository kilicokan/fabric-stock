# AGENTS.md - Fabric Stock Development Guide

## Build & Test Commands
- **Dev**: `npm run dev` (Next.js + Tauri window)
- **Build**: `npm run build` (Next.js + Tauri desktop)
- **Lint**: `npm run lint` (ESLint + Next.js rules)
- **Test**: `npm test` (Jest); `npm run test:watch` (watch mode)

## Architecture
**Stack**: Next.js 15 + React 19 + TypeScript + Prisma + PostgreSQL + Tauri (desktop)

**Key Modules**:
- `pages/` - User screens (stock, fason work orders, tracking)
- `pages/api/` - REST endpoints (stock, fason, auth)
- `components/ui/` - Radix UI component library with Tailwind
- `lib/prisma.ts` - Prisma singleton instance
- `src-tauri/` - Desktop app configuration

**Database**: PostgreSQL via Prisma (see `prisma/schema.prisma`)

**Critical Entities**: User, WorkOrder, Workshop, FabricEntry, FabricExit, FasonTracking

## Code Style & Patterns
- **Auth**: JWT tokens in localStorage; verify with `Bearer {token}` header in API routes
- **API Routes**: Switch on `req.method`; verify token first; return `{ error: "msg" }` on failure
- **Forms**: Use `useState` for form data; validate before submit; batch operations with error tracking
- **UI**: Radix UI + Tailwind; Turkish language for UI text
- **Types**: TypeScript strict mode disabled (`"strict": false` in tsconfig); use `noImplicitAny: true`
- **Imports**: Use `@/*` path alias; import `prisma` from `@/lib/prisma`
- **Enums**: Case-sensitive (e.g., `BEKLIYOR` not `Bekliyor`)

**See**: `.github/copilot-instructions.md` for detailed patterns, Fason workflow, and examples
