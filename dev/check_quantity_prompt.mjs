// 数量入力(ui/shared.js の promptQuantity / parseQuantity)の検算スクリプト。
//   node dev/check_quantity_prompt.mjs scripts   (パックのルートで実行。フォームはスタブ)
import { register } from "node:module";
import path from "node:path"; import { pathToFileURL } from "node:url";
globalThis.__shown = [];
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(s,c,n){ if(s==="@minecraft/server-ui"||s==="@minecraft/server") return {url:"data:text/javascript,stub:"+s,shortCircuit:true}; return n(s,c);}
export async function load(u,c,n){ if(u.startsWith("data:text/javascript,stub:")) return {format:"module",shortCircuit:true,source:
 "export class ModalFormData{ title(t){this.t=t;return this} textField(l,p,o){this.tf=o;return this} toggle(l,o){return this} show(pl){ return Promise.resolve(globalThis.__next.shift()); } }"+
 "export class ActionFormData{}; export const world={getDay(){return 1},getDynamicProperty(){},setDynamicProperty(){}}; export const system={};"}; return n(u,c);}
`));
const root = process.argv[2];
const { parseQuantity, promptQuantity } = await import(pathToFileURL(path.join(root,"ui/shared.js")).href);
let bad=0; const eq=(a,b,m)=>{ if(a!==b){bad++;console.log("NG",m,a,b);} };
eq(parseQuantity("250"),250,"plain"); eq(parseQuantity("１,２３４"),1234,"fullwidth+comma"); eq(parseQuantity(" 12 "),12,"spaces");
eq(parseQuantity("abc"),null,"alpha"); eq(parseQuantity("1.5"),null,"decimal"); eq(parseQuantity("-3"),null,"neg"); eq(parseQuantity(""),null,"empty");
const msgs=[]; const player={ sendMessage:(m)=>msgs.push(m), getDynamicProperty(){}, };
const run = (seq) => new Promise((resolve)=>{ globalThis.__next = seq; let out=null;
  promptQuantity(player,{title:"t",max:100,onSubmit:(q)=>{out="submit:"+q;resolve(out)},onBack:()=>{out="back";resolve(out)}}); });
eq(await run([{canceled:false,formValues:["37",false]}]),"submit:37","normal");
eq(await run([{canceled:false,formValues:["5",true]}]),"submit:100","all toggle");
eq(await run([{canceled:true}]),"back","cancel");
eq(await run([{canceled:false,formValues:["999",false]},{canceled:false,formValues:["20",false]}]),"submit:20","retry after out-of-range");
eq(await run([{canceled:false,formValues:["x",false]},{canceled:true}]),"back","retry then cancel");
eq(msgs.length,2,"error messages shown");
console.log(bad===0?"OK":bad+" problem(s)");
