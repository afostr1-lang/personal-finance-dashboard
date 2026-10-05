export type TxType="Income"|"Expense"|"Savings"|"Loan Payment"|"Investment"|"Transfer"|"Other";
export interface Transaction{id:string;date:string;type:TxType;category:string;description:string;account:string;paymentMethod:string;amount:number;notes:string}
export interface Budget{id:string;month:string;category:string;amount:number}
export interface Goal{id:string;name:string;target:number;current:number;dueDate:string;notes:string}
export interface Loan{id:string;name:string;original:number;balance:number;rate:number;minimum:number;dueDay:number}
export interface Account{id:string;name:string;type:string;opening:number;balance:number;institution:string}
export interface Recurring{id:string;name:string;type:TxType;category:string;amount:number;frequency:string;nextDate:string;account:string}
export interface FinanceData{transactions:Transaction[];budgets:Budget[];goals:Goal[];loans:Loan[];accounts:Account[];recurring:Recurring[]}