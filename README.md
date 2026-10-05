# FinanceFlow — Personal Finance Dashboard

A modern personal-finance web application with an Excel workbook as its portable backend.

## Major build features
- Dashboard: monthly income, expenses, savings, investments, debt payments, net cash flow, savings rate and net worth
- Native calendar date picker
- Searchable transaction history
- Monthly category budgets with budget-vs-actual progress and overspend warnings
- Savings goals with funding progress
- Loan balances, APR, minimum payments and payoff progress
- Account / asset balances and net-worth rollup
- Recurring bills and income
- Responsive app-style UI for desktop, tablet and mobile
- Excel export at any time

## Excel data model
The server automatically creates and maintains these worksheets in `server/data/finance-data.xlsx`:
`Transactions`, `Budgets`, `Goals`, `Loans`, `Accounts`, and `Recurring`.

Existing transaction data remains compatible when the newer sheets are added.

## Stack
React 19 + TypeScript + Vite, Express 5, ExcelJS, Recharts, Lucide.

## Local development
```bash
npm install
npm run dev
```
Open http://localhost:5173.

## Production
```bash
npm run build
npm start
```

> Excel persistence is designed for a personal/single-writer deployment. If this becomes a concurrent multi-user product, migrate live persistence to PostgreSQL or SQLite and keep Excel for import/export and reporting.
