import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const modelPackages=/^(?:(?:ai|openai|@google-cloud\/vertexai|@anthropic-ai\/sdk|@google\/(?:genai|generative-ai)|langchain|ollama|cohere-ai|replicate)(?:$|\/)|@ai-sdk\/|@langchain\/|@mistralai\/)/;
const modelHosts=/https?:\/\/(?:api\.openai\.com|ai-gateway\.vercel\.sh|api\.deepseek\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|aiplatform\.googleapis\.com|api\.cohere\.(?:com|ai)|api\.mistral\.ai|api\.replicate\.com|api-inference\.huggingface\.co)(?:[/:\s'"`]|$)/i;
const violations=[];
const manifest=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));
for(const name of Object.keys(manifest.dependencies||{}))if(modelPackages.test(name))violations.push(`Dependência de modelos: ${name}`);
function scan(file){const text=readFileSync(path.join(root,file),'utf8');if(modelHosts.test(text))violations.push(`Endpoint de modelos: ${file}`);}
function walk(directory){for(const entry of readdirSync(path.join(root,directory),{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())walk(file);else if(/\.[cm]?[jt]sx?$/.test(file)&&!file.endsWith('.test.ts'))scan(file);}}
for(const directory of ['src','server','api'])walk(directory);scan('server.ts');
if(violations.length){console.error(violations.join('\n'));process.exitCode=1;}else console.log('Operação convencional: nenhuma dependência direta ou endpoint conhecido de modelos encontrado nas fontes de execução.');
