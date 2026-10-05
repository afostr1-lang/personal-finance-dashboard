import express from "express"; import cors from "cors"; import path from "node:path"; import { addTransaction,file,listTransactions,removeTransaction,summarize } from "./excelStore";
const app=express(); app.use(cors()); app.use(express.json());
app.get("/api/transactions",async(_req,res)=>res.json(await listTransactions()));
app.post("/api/transactions",async(req,res)=>{const b=req.body; if(!b.date||!b.type||!Number.isFinite(Number(b.amount))||Number(b.amount)<0)return res.status(400).json({message:"Date, type and a valid amount are required."}); res.status(201).json(await addTransaction({...b,amount:Number(b.amount)}));});
app.delete("/api/transactions/:id",async(req,res)=>{const ok=await removeTransaction(req.params.id); res.status(ok?204:404).end();});
app.get("/api/summary",async(req,res)=>res.json(summarize(await listTransactions(),typeof req.query.month==="string"?req.query.month:undefined)));
app.get("/api/export",(_req,res)=>res.download(file,"finance-data.xlsx"));
const dist=path.resolve("dist"); app.use(express.static(dist)); app.get("*",(_req,res)=>res.sendFile(path.join(dist,"index.html")));
app.listen(3001,()=>console.log("Finance API running on http://localhost:3001"));