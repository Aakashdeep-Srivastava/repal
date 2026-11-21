import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
const wx = { wx: tool({ description:"weather", inputSchema:z.object({city:z.string()}), execute:async({city})=>({city,tempC:21}) }) };
async function test(name:string, model:any){
  try { const r=await generateText({model,tools:wx,stopWhen:stepCountIs(4),prompt:"Weather in Paris? use tool then tell me."}); console.log(`${name}: OK steps=${r.steps?.length} "${(r.text||'').slice(0,40)}"`); }
  catch(e:any){ console.log(`${name}: FAIL ${(e?.message??'').slice(0,120)}`); }
}
async function main(){
  await test("groq", createOpenAI({name:"groq",baseURL:"https://api.groq.com/openai/v1",apiKey:process.env.GROQ_API_KEY}).chat(process.env.GROQ_MODEL??"openai/gpt-oss-120b"));
  await test("openrouter", createOpenAI({name:"openrouter",baseURL:"https://openrouter.ai/api/v1",apiKey:process.env.OPENROUTER_API_KEY}).chat(process.env.OPENROUTER_MODEL??"nvidia/nemotron-3-ultra-550b-a55b:free"));
  await test("gemini(native)", createGoogleGenerativeAI({apiKey:process.env.GEMINI_API_KEY})("gemini-flash-latest"));
}
main();
