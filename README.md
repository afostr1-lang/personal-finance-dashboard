# Personal Finance Dashboard

A modern web app for tracking income, expenses, savings, loans and investments while keeping the underlying data in an Excel workbook.

## Architecture
- React + TypeScript + Vite frontend
- Express API
- ExcelJS workbook persistence in `server/data/finance-data.xlsx`
- Native calendar date picker for transaction entry
- Excel export endpoint

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:5173

## Production
```bash
npm run build
npm start
```

## Notes
Excel is practical for a single-user/personal deployment. For simultaneous multi-user usage, move live persistence to SQLite/PostgreSQL while retaining Excel import/export.
