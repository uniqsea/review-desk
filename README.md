# Review Desk

Review Desk is a simple PRISMA review system for managing paper screening work.

It is built for PRISMA-style literature screening: importing records, reviewing studies one by one, recording screening decisions, and tracking progress in a single workspace.

## What It Does

- Import paper data from BibTeX files
- Support PRISMA screening workflow for study selection
- View pending and processed records
- Mark items as included, excluded, or uncertain
- Save screening reasons and decision notes
- Track review progress and decision history
- Store local data with SQLite

## Tech Stack

- Next.js
- React
- TypeScript
- TanStack Query
- Drizzle ORM
- SQLite

## Local Development

```bash
npm install
npm run dev
```

If needed, initialize the local database with:

```bash
npm run db:init
```

## Update Log

### 2026-03-17

- Changed duplicate detection to run within the target project instead of globally
- Added `.gitignore`
- Added initial `README.md`
- Clarified README positioning for PRISMA screening workflow
- Added project-based import workflow
- Added project rename support from the current project switcher
