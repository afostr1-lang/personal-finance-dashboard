// Client-side extraction: files remain on the device. Results must be reviewed.
export type ReceiptDetails={description?:string;date?:string;amount?:string;category?:string;rawText:string};
const categories:[RegExp,string][]=[[/supermarket|grocery|grocer|fresh|market|food store/i,"Groceries"],[/restaurant|cafe|coffee|dining|grill|pizza|kfc|burger/i,"Dining"],[/fuel|petrol|gas station|shell|texaco|rubis|fesco/i,"Fuel"],[/pharmacy|medical|clinic|hospital/i,"Health"],[/taxi|uber|transport|bus/i,"Transportation"],[/electric|water|internet|utility|telecom/i,"Utilities"]];
function extract(text:string):ReceiptDetails{
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const merchant=lines.find(x=>/[a-z]{3}/i.test(x)&&!/(receipt|invoice|tax invoice|date|cashier|telephone|phone|welcome|thank you)/i.test(x))?.slice(0,90);
 const moneyValue=(s:string)=>{const m=s.replace(/,/g,"").match(/(?:J\$|\$|JMD\s*)?\s*(\d{1,8}(?:\.\d{2})?)/i);return m?Number(m[1]):null};
 const totals=lines.filter(x=>/\b(grand\s*total|total\s*due|amount\s*due|balance\s*due|total\s*paid|total)\b/i.test(x)&&!/subtotal|sub total|tax total|items total|total items|change|discount/i.test(x));
 const candidates=totals.map(x=>{const matches=[...x.replace(/,/g,"").matchAll(/\d{1,8}(?:\.\d{2})?/g)];return matches.length?Number(matches[matches.length-1][0]):null}).filter((n):n is number=>n!==null&&n>0);
 const total=candidates.length?candidates[candidates.length-1]:null;
 const dm=text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/)||text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
 let date: string|undefined;
 if(dm){const iso=dm[1].length===4?[dm[1],dm[2],dm[3]]:[dm[3],dm[2],dm[1]];const dt=new Date(iso.map((x,i)=>i?x.padStart(2,"0"):x).join("-")+"T12:00:00");if(!Number.isNaN(dt.getTime()))date=dt.toISOString().slice(0,10)}
 const category=categories.find(([re])=>re.test((merchant||"")+" "+text.slice(0,250)))?.[1];
 return {description:merchant,date,amount:total===null?undefined:total.toFixed(2),category,rawText:text.slice(0,12000)};
}
export async function readReceipt(file:File):Promise<ReceiptDetails>{
 if(file.size>10*1024*1024)throw Error("Receipt must be 10 MB or smaller.");
 let text="";
 if(file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf")){
  const pdfjs=await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc=(await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  if(pdf.numPages>5)throw Error("For now, upload a PDF with up to five pages.");
  for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();const pageText=content.items.map((x:any)=>x.str||"").join("\n");text+="\n"+pageText;
   if(pageText.trim().length<35){const vp=page.getViewport({scale:1.6});const canvas=document.createElement("canvas");canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);const ctx=canvas.getContext("2d");if(!ctx)throw Error("Cannot process PDF page");await page.render({canvasContext:ctx,viewport:vp,canvas} as any).promise;text+="\n"+await ocr(canvas)}
  }
 }else if(file.type.startsWith("image/"))text=await ocr(file);
 else throw Error("Please select a PDF, JPG, PNG or WEBP receipt.");
 if(!text.trim())throw Error("No readable text found. Try a clearer receipt image.");
 return extract(text);
}
async function ocr(input:File|HTMLCanvasElement){const {createWorker}=await import("tesseract.js");const worker=await createWorker("eng");try{const result=await worker.recognize(input);return result.data.text}finally{await worker.terminate()}}
