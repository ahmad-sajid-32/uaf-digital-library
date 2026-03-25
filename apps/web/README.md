# UAF Smart E-Library Frontend

Next.js App Router frontend for the UAF Smart E-Library & University Information Assistant.

## Purpose

This application is the public web client. It currently covers:

- guest authentication screens
- semantic theme tokens with light/dark mode
- reusable UI primitives
- browser-side Supabase Auth flows

## Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- `next-themes`
- Supabase JavaScript client
- Radix UI primitives
- Sonner for toast notifications

## Local Setup

```bash
cd apps/web
npm install
```

## Environment Variables

Create `apps/web/.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_BASE_URL=your_api_base_url
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` is required.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is required.
- `NEXT_PUBLIC_API_BASE_URL` is reserved for future frontend-to-backend integration and is not required by the current guest auth flow.

## Supabase Auth Requirements

Before testing password recovery, configure Supabase Auth:

### Auth -> URL Configuration

- Site URL: `http://localhost:3000`
- Redirect URLs must include:
  - `http://localhost:3000/reset-password`
  - `http://localhost:3000/setup-password`
  - `https://your-production-domain/reset-password`
  - `https://your-production-domain/setup-password`

### Auth -> Email Templates

- update the reset password template with the approved project copy
- ensure the recovery link returns the user to `/reset-password`

## Run

```bash
cd apps/web
npm run dev
```

Default local URL:

- `http://localhost:3000`

## Current Route Surface

- `/`
  Redirects to `/login`
- `/login`
  Supabase email/password sign-in
- `/forgot-password`
  Recovery email request flow
- `/reset-password`
  Supabase recovery session landing and password reset
- `/setup-password`
  First-time password setup for admin-created users

## Theme System

The frontend uses semantic design tokens only. Components should use token classes such as:

- `bg-background`
- `text-foreground`
- `bg-card`
- `border-border`
- `bg-primary`
- `text-primary-foreground`

Dark mode is class-based and controlled through the shared theme provider.

## Validation

Run this before pushing frontend changes:

```bash
npm run lint
```

Run a production build when you need to validate the full app bundle:

```bash
npm run build
```
