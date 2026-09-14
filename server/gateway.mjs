// Explicitly authorized personal lab gateway; do not run on a production host.
import http from 'node:http';
import{spawn}from'node:child_process';
import{hostname,userInfo,homedir}from'node:os';
import{timingSafeEqual}from'node:crypto';
import{pathToFileURL}from'node:url';
import{levels}from'../curriculum.js';
import{extendCurriculum}from'../workplace.js';
extendCurriculum(levels);
import{stateChecks,evidencePass}from'./checks.mjs';
export function createGateway({token,origins,runCommand=runShell,identity=()=>({hostname:hostname(),user:userInfo().username})}){
 if(typeof token!=='string'||token.length<32)throw Error('LAB_TOKEN must have at least 32 characters.');
 const allowed=new Set(origins);if(!allowed.size||allowed.has('*'))throw Error('Set explicit LAB_ORIGINS, never *.');
 const sessions=new Map();let running=0;
 const authenticate=req=>{const value=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);return value.length===expected.length&&timingSafeEqual(value,expected)};
 return http.createServer(async(req,res)=>{
  const origin=req.headers.origin;res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(status===204?undefined:JSON.stringify(data))};
  if(origin&&!allowed.has(origin)){send(403,{error:'Origin is not allowed.'});return}
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
  if(req.method==='OPTIONS'){send(204,{});return}
  if(!authenticate(req)){send(401,{error:'Invalid access token.'});return}
  if(req.method==='GET'&&req.url==='/health'){send(200,{kind:'rockylab-gateway',...identity(),interactive:false});return}
  if(req.method!=='POST'||!['/run','/check'].includes(req.url)){send(404,{error:'Not found.'});return}
  if(!String(req.headers['content-type']||'').startsWith('application/json')){send(415,{error:'JSON required.'});return}
  if(running>=2){send(429,{error:'The lab is busy. Try again shortly.'});return}
  let body='';try{for await(const part of req){body+=part;if(Buffer.byteLength(body)>16384){send(413,{error:'Request too large.'});return}}}catch{return}
  let data;try{data=JSON.parse(body);if(!data||typeof data!=='object'||Array.isArray(data))throw Error()}catch{send(400,{error:'Invalid JSON object.'});return}
  const sessionKey=origin||'local-client';let records=sessions.get(sessionKey)||[];
  if(running>=2){send(429,{error:'The lab is busy. Try again shortly.'});return}running++;
  try{
   if(req.url==='/run'){
    if(typeof data.command!=='string'||!data.command.trim()||data.command.length>8192){send(400,{error:'Provide a command of 1–8192 characters.'});return}
    const result=await runCommand(data.command);records.push({command:data.command,...result});sessions.set(sessionKey,records.slice(-100));
    send(200,result);
   }else{
    const level=levels.find(l=>l.id===data.level),task=level?.tasks.find(t=>t.check===data.check);
    if(!task){send(400,{error:'Unknown objective.'});return}
    let passed=false;
    if(Object.hasOwn(stateChecks,task.check))passed=(await runCommand(stateChecks[task.check])).code===0;
    else passed=evidencePass(task.check,records);
    send(200,{passed,check:task.check,mode:'real'});
   }
  }catch{send(500,{error:'Lab execution failed.'})}finally{running--}
 });
}
export function runShell(command){return new Promise((resolve,reject)=>{
 // This bearer token is shell access. A VM/VPN is the isolation boundary.
 // No root gateway, no shell secrets forwarded, bounded output and process lifetime.
 const env={...process.env,PAGER:'cat',SYSTEMD_PAGER:'cat',GIT_TERMINAL_PROMPT:'0'};delete env.LAB_TOKEN;delete env.LAB_ORIGINS;
 const child=spawn('/bin/bash',['--noprofile','--norc','-c',command],{cwd:homedir(),detached:true,env,stdio:['ignore','pipe','pipe']});
 let output='',settled=false,truncated=false,timedOut=false;
 const kill=()=>{try{process.kill(-child.pid,'SIGKILL')}catch{}};
 const timeout=setTimeout(()=>{timedOut=true;kill()},20000);
 const collect=chunk=>{if(Buffer.byteLength(output)+chunk.length>1024*1024){truncated=true;kill();return}output+=chunk.toString('utf8')};
 child.stdout.on('data',collect);child.stderr.on('data',collect);
 child.on('error',err=>{if(settled)return;settled=true;clearTimeout(timeout);reject(err)});
 child.on('close',code=>{if(settled)return;settled=true;clearTimeout(timeout);kill();resolve({out:output+(timedOut?'\nStopped after 20 seconds. Use Cockpit for interactive or long-running work.':'')+(truncated?'\nOutput exceeded 1 MiB. Narrow the query.':''),code:timedOut?124:truncated?125:code??1})});
})}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.platform!=='linux'||process.getuid?.()===0)throw Error('Run as an unprivileged user on a dedicated Linux lab VM.');
 const token=process.env.LAB_TOKEN,origins=(process.env.LAB_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean),port=Number(process.env.LAB_PORT||8787);
 const server=createGateway({token,origins});server.listen(port,'127.0.0.1',()=>console.log('RockyLab gateway: 127.0.0.1:'+port+'; use HTTPS/VPN.'));
}


