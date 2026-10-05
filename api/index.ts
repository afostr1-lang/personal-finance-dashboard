import { neon } from "@neondatabase/serverless";
import ExcelJS from "exceljs";

const kinds = ["transactions","budgets","goals","loans","accounts","recurring"] as const;
type Kind = typeof kinds[number];

const tableSql: Record<Kind,string> = {
 transactions: `CREATE TABLE IF NOT EXISTS transactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), date DATE NOT NULL, type TEXT NOT NULL, category TEXT DEFAULT '', description TEXT DEFAULT '', account TEXT DEFAULT '', payment_method TEXT DEFAULT '', amount DOUBLE PRECISION NOT NULL DEFAULT 0, notes TEXT DEFAULT '')`,
 budgets: `CREATE TABLE IF NOT EXISTS budgets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), month TEXT NOT NULL, category TEXT NOT NULL, amount DOUBLE PRECISION NOT NULL DEFAULT 0)`,
 goals: `CREATE TABLE IF NOT EXISTS goals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, target DOUBLE PRECISION NOT NULL DEFAULT 0, current DOUBLE PRECISION NOT NULL DEFAULT 0, due_date DATE, notes TEXT DEFAULT '')`,
 loans: `CREATE TABLE IF NOT EXISTS loans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, original DOUBLE PRECISION NOT NULL DEFAULT 0, balance DOUBLE PRECISION NOT NULL DEFAULT 0, rate DOUBLE PRECISION NOT NULL DEFAULT 0, minimum DOUBLE PRECISION NOT NULL DEFAULT 0, due_day INTEGER NOT NULL DEFAULT 1)`,
 accounts: `CREATE TABLE IF NOT EXISTS accounts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, type TEXT NOT NULL, opening DOUBLE PRECISION NOT NULL DEFAULT 0, balance DOUBLE PRECISION NOT NULL DEFAULT 0, institution TEXT DEFAULT '')`,
 recurring: `CREATE TABLE IF NOT EXISTS recurring (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, type TEXT NOT NULL, category TEXT DEFAULT '', amount DOUBLE PRECISION NOT NULL DEFAULT 0, frequency TEXT DEFAULT '', next_date DATE, account TEXT DEFAULT '')`
};
const cols:Record<Kind,string[]>={
 transactions:["date","type","category","description","account","payment_method","amount","notes"],
 budgets:["month","category","amount"],goals:["name","target","current","due_date","notes"],
 loans:["name","original","balance","rate","minimum","due_day"],accounts:["name","type","opening","balance","institution"],
 recurring:["name","type","category","amount","frequency","next_date","account"]
};
const camel=(r:any)=>{const o:any={};for(const[k,v]of Object.entries(r))o[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase())]=v;return o};
async function setup(sql:any){for(const k of kinds)await sql.query(tableSql[k])}
async function all(sql:any){const out:any={};for(const k of kinds)out[k]=(await sql.query(`SELECT * FROM ${k} ORDER BY 1 DESC`)).map(camel);return out}

export default async function handler(req:any,res:any){
 try{
  if(!process.env.DATABASE_URL)return res.status(500).json({message:"DATABASE_URL is not configured."});
  const sql=neon(process.env.DATABASE_URL);await setup(sql);
  const url=new URL(req.url,"https://finance.local"),parts=url.pathname.replace(/^\/api\/?/,"").split("/").filter(Boolean);
  if(req.method==="GET"&&parts[0]==="data")return res.status(200).json(await all(sql));
  if(req.method==="GET"&&parts[0]==="health")return res.status(200).json({ok:true,storage:"neon"});
  if(req.method==="GET"&&parts[0]==="export"){
   const data=await all(sql),wb=new ExcelJS.Workbook();
   for(const k of kinds){const ws=wb.addWorksheet(k[0].toUpperCase()+k.slice(1));const rows=data[k];const headers=rows.length?Object.keys(rows[0]):["id"];ws.addRow(headers);for(const row of rows)ws.addRow(headers.map(h=>row[h]??""))}
   const buf=await wb.xlsx.writeBuffer();res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");res.setHeader("Content-Disposition",'attachment; filename="finance-data.xlsx"');return res.status(200).send(Buffer.from(buf));
  }
  const kind=parts[0] as Kind;if(!kinds.includes(kind))return res.status(404).json({message:"Unknown endpoint"});
  if(req.method==="POST"){const fields=cols[kind],body=req.body||{},values=fields.map(x=>body[camel({[x]:"x"})&&x]??body[x.replace(/_([a-z])/g,(_,c)=>c.toUpperCase())]??null);const qs=fields.map((_,i)=>"$"+(i+1)).join(",");const rows=await sql.query(`INSERT INTO ${kind} (${fields.join(",")}) VALUES (${qs}) RETURNING *`,values);return res.status(201).json(camel(rows[0]));}
  if(req.method==="DELETE"&&parts[1]){await sql.query(`DELETE FROM ${kind} WHERE id=$1`,[parts[1]]);return res.status(204).end();}
  return res.status(405).json({message:"Method not allowed"});
 }catch(e:any){console.error(e);return res.status(500).json({message:e?.message||"Server error"});}
}