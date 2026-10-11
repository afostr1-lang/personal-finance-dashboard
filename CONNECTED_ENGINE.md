# Connected financial engine — initial safe rollout

## What is implemented

Account balance tracking is **opt-in per account**. Until enabled, FinanceFlow continues showing the manually maintained `accounts.balance`. Enabling tracking creates a separate `account_tracking` baseline at the current balance and timestamp. The original account balance and historical transaction records are never rewritten.

For a tracked account, the displayed effective balance is:

`baseline + income recorded after activation - expenses, savings, investments and loan payments recorded after activation`.

The dashboard financial position uses effective account balances less manually maintained loan balances. Monthly income, expense, savings, investment and debt-payment summaries remain based on transaction types. The export continues to include original account and transaction records.

### Safety and limitations

- Existing transactions are **not** applied retroactively. This prevents the common double-counting problem when the opening balance already incorporates those transactions.
- Account matching is currently by **exact account name**. Give accounts unique names. Changing the name of a tracked account is blocked.
- The account selector in new transactions and receipt capture now offers names from saved accounts.
- Transfers do **not** change account balances automatically because a transfer needs explicit source and destination accounts. Do not record transfers as expenses.
- Savings and investment transactions currently reduce the source account; destination account credits are not automated. Recording a savings contribution and manually increasing a savings account can produce an inconsistent combined balance. Use only one representation until transfer pairing is implemented.
- Loan payment transactions reduce the selected source account but **do not** amortize or reduce loan principal automatically. The loan balance remains manually maintained.
- Editing or deleting an eligible transaction changes the derived account balance. Dates before activation do not matter for eligibility: the original record creation time is used.
- Manual edits of a tracked account's name or stored balance are blocked. There is not yet a self-service disable/reconciliation flow.
- New accounts and historical transactions remain intact. No data is deleted or rewritten by enabling tracking.
- Financial arithmetic currently uses floating-point amounts; decimal-based currency accounting and atomic ledger posting are future work.
- This has not been validated against the production database or deployed Vercel environment. Back up Neon and test on a nonproduction database before enabling on real accounts.

## Before broader automation

Implement account IDs on transactions, explicit two-sided transfers, savings goal allocation, principal/interest loan payments, atomic database transactions, reconciliation workflows, and automated integration tests. Do not silently backfill old records or enable tracking for every account.
