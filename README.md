# Review Desk

Review Desk is a simple review system for managing paper screening work.

It is built for quickly importing records, reviewing items one by one, marking decisions, and tracking progress in a single workspace.

## What It Does

- Import paper data from BibTeX files
- View pending and processed records
- Mark items as included, excluded, or uncertain
- Save decision reasons
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

- Added `.gitignore`
- Added initial `README.md`
- Confirmed project naming direction as `Review Desk`
