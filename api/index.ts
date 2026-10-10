import {createHmac,timingSafeEqual,randomBytes} from "node:crypto";
import { neon } from "@neondatabase/serverless";
import ExcelJS from "exceljs";

const safeEqual=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
const sign=(value:string,secret:string)=>createHmac("sha256",secret).update(value).digest("hex");
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
  const password=process.env.FINANCEFLOW_PASSWORD,secret=process.env.FINANCEFLOW_SESSION_SECRET;
  if(!password||!secret||secret.length<32)return res.status(503).json({message:"Security setup required: configure FINANCEFLOW_PASSWORD and FINANCEFLOW_SESSION_SECRET (32+ characters) in Vercel."});
  res.setHeader("Cache-Control","no-store");
  const url=new URL(req.url,"https://finance.local"),parts=url.pathname.replace(/^\/api\/?/,"").split("/").filter(Boolean);
  if(parts[0]==="login"&&req.method==="POST"){
    const db=neon(process.env.DATABASE_URL);
    await db.query("CREATE TABLE IF NOT EXISTS login_attempts (client_key TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, window_start TIMESTAMPTZ NOT NULL DEFAULT now(), locked_until TIMESTAMPTZ)");
    const ip=String(req.headers["x-forwarded-for"]||req.socket?.remoteAddress||"unknown").split(",")[0].trim();
    const clientKey=sign(ip,secret);
    const checks=await db.query("SELECT locked_until FROM login_attempts WHERE client_key=$1",[clientKey]);
    if(checks[0]?.locked_until&&new Date(checks[0].locked_until).getTime()>Date.now())return res.status(429).json({message:"Too many attempts. Try again in 15 minutes."});

    if(!safeEqual(String(req.body?.password||""),password)){
      await db.query("INSERT INTO login_attempts(client_key,attempts,window_start,locked_until) VALUES($1,1,now(),NULL) ON CONFLICT(client_key) DO UPDATE SET attempts=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END, window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END, locked_until=CASE WHEN login_attempts.window_start>=now()-interval '15 minutes' AND login_attempts.attempts>=4 THEN now()+interval '15 minutes' ELSE NULL END",[clientKey]);
      return res.status(401).json({message:"Incorrect password"});
    }
    await db.query("DELETE FROM login_attempts WHERE client_key=$1",[clientKey]);
    const expires=Date.now()+7*86400000,nonce=randomBytes(16).toString("hex"),value=expires+"."+nonce,token=value+"."+sign(value,secret);
    res.setHeader("Set-Cookie","ff_session="+token+"; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800");return res.status(200).json({ok:true});
  }
  if(parts[0]==="logout"&&req.method==="POST"){res.setHeader("Set-Cookie","ff_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");return res.status(200).json({ok:true})}
  const cookie=String(req.headers.cookie||"").split(";").map((x:string)=>x.trim()).find((x:string)=>x.startsWith("ff_session="))?.slice(11)||"";
  const pieces=cookie.split("."),value=pieces.slice(0,2).join("."),valid=pieces.length===3&&Number(pieces[0])>Date.now()&&safeEqual(sign(value,secret),pieces[2]);
  if(!valid)return res.status(401).json({message:"Authentication required"});
  if(!["GET","HEAD"].includes(req.method)&&req.headers.origin){
    const origin=new URL(req.headers.origin).host,host=String(req.headers.host||"");
    if(origin!==host)return res.status(403).json({message:"Cross-origin request rejected"});
  }
  const sql=neon(process.env.DATABASE_URL);await setup(sql);
  if(req.method==="GET"&&parts[0]==="data")return res.status(200).json(await all(sql));
  if(req.method==="GET"&&parts[0]==="health")return res.status(200).json({ok:true,storage:"neon"});
  if(req.method==="GET"&&parts[0]==="export"){
   const data=await all(sql),wb=new ExcelJS.Workbook();
   for(const k of kinds){const ws=wb.addWorksheet(k[0].toUpperCase()+k.slice(1));const rows=data[k];const headers=rows.length?Object.keys(rows[0]):["id"];ws.addRow(headers);for(const row of rows)ws.addRow(headers.map(h=>row[h]??""))}
   const buf=await wb.xlsx.writeBuffer();res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");res.setHeader("Content-Disposition",'attachment; filename="finance-data.xlsx"');return res.status(200).send(Buffer.from(buf));
  }
  const kind=parts[0] as Kind;if(!kinds.includes(kind))return res.status(404).json({message:"Unknown endpoint"});
  if(req.method==="PATCH"&&parts[1]){const body=req.body||{},fields=cols[kind].filter(x=>Object.prototype.hasOwnProperty.call(body,x)||Object.prototype.hasOwnProperty.call(body,x.replace(/_([a-z])/g,(_,c)=>c.toUpperCase())));if(!fields.length)return res.status(400).json({message:"No changes provided"});const values=fields.map(x=>body[x.replace(/_([a-z])/g,(_,c)=>c.toUpperCase())]??body[x]);const updates=fields.map((x,i)=>x+"=$"+(i+1)).join(",");const rows=await sql.query("UPDATE "+kind+" SET "+updates+" WHERE id=$"+(fields.length+1)+" RETURNING *",[...values,parts[1]]);return rows.length?res.status(200).json(camel(rows[0])):res.status(404).json({message:"Record not found"});}
  if(req.method==="POST"&&kind==="transactions"&&String(req.body?.notes||"").startsWith("Receipt reviewed:")){
    const b=req.body||{};
    const matches=await sql.query("SELECT id FROM transactions WHERE type='Expense' AND date=$1 AND amount=$2 AND lower(trim(description))=lower(trim($3)) LIMIT 1",[b.date,Number(b.amount),String(b.description||"")]);
    if(matches.length)return res.status(409).json({message:"This receipt appears to have already been recorded."});
  }
  if(req.method==="POST"){const fields=cols[kind],body=req.body||{},values=fields.map(x=>body[x.replace(/_([a-z])/g,(_,c)=>c.toUpperCase())]??body[x]??null);const qs=fields.map((_,i)=>"$"+(i+1)).join(",");const rows=await sql.query(`INSERT INTO ${kind} (${fields.join(",")}) VALUES (${qs}) RETURNING *`,values);return res.status(201).json(camel(rows[0]));}
  if(req.method==="DELETE"&&parts[1]){await sql.query(`DELETE FROM ${kind} WHERE id=$1`,[parts[1]]);return res.status(204).end();}
  return res.status(405).json({message:"Method not allowed"});
 }catch(e:any){console.error(e);return res.status(500).json({message:e?.message||"Server error"});}
}