// Educational subset only. Unimplemented syntax fails explicitly.
export class PracticeShell{
 constructor(){this.reset()}
 reset(){this.cwd='/home/student';this.prev=this.cwd;this.user='student';this.host='rocky';this.fs={};this.events=new Set();this.history=[];this.packages=new Set(['bash','openssh-clients','openssh-server','rsyslog']);this.services={sshd:{active:true,enabled:true},httpd:{active:false,enabled:false}};this.groups={student:[],wheel:['student']};this.users={student:1000,root:0};this.jobList=[];this.logs=['sshd: Server listening on port 22.'];this.mask='0022';for(const d of ['/','/home','/home/student','/etc','/tmp','/var','/var/log','/usr','/usr/bin'])this.fs[d]={dir:true,mode:'755'};this.put('/etc/os-release','NAME="Rocky Linux"\nID="rocky"\nVERSION_ID="9"\n');this.put('/etc/passwd','root:x:0:0:root:/root:/bin/bash\nstudent:x:1000:1000:Student:/home/student:/bin/bash\n');this.put('/etc/hosts','127.0.0.1 localhost\n192.168.56.10 rocky\n');this.put('/home/student/.bashrc','# RockyLab practice shell\n');this.put('/var/log/messages','RockyLab: system ready\n')}
 path(p='~'){if(p==='~')p='/home/student';else if(p.startsWith('~/'))p='/home/student/'+p.slice(2);const a=(p.startsWith('/')?p:this.cwd+'/'+p).split('/'),b=[];for(const q of a){if(!q||q==='.')continue;if(q==='..')b.pop();else b.push(q)}return '/'+b.join('/')}
 put(path,text){this.fs[this.path(path)]={text,mode:'644',owner:this.user,group:this.user}}
 node(p){let n=this.fs[this.path(p)];if(n?.link)n=this.fs[n.link];return n}
 read(p){const n=this.node(p);if(!n||n.dir)throw Error(p+': not a readable file');return n.text}
 tokens(s){const m=s.match(/"(?:\\.|[^"])*"|'[^']*'|[^\s]+/g)||[];return m.map(t=>/^["']/.test(t)?t.slice(1,-1):t)}
 run(raw){this.history.push(raw);try{let code=0,out=[];for(const line of raw.split('\n').filter(x=>x.trim())){let r=this.line(line);code=r.code;if(r.out)out.push(r.out)}return{out:out.join('\n'),code}}catch(e){return{out:e.message,code:1}}}
 line(raw){if(raw.includes('&&')){let out=[];for(const part of raw.split('&&')){const r=this.line(part.trim());out.push(r.out);if(r.code)return{out:out.join('\n'),code:r.code}}return{out:out.join('\n'),code:0}}
 if(raw.includes('||')){const [a,b]=raw.split('||');const r=this.line(a.trim());return r.code?this.line(b.trim()):r}
 if(/[;&]/.test(raw)&&!/^sleep \d+ &$/.test(raw.trim()))return{out:'Simulator: this shell syntax requires the real lab.',code:2};
 let pipe=raw.split('|'),stdin=null,result;for(const part of pipe){result=this.one(part.trim(),stdin);if(result.code)return result;stdin=result.out}if(pipe.length>1&&/wc\s+-l/.test(raw)&&this.readSafe('~/notes.txt')==='first line\nsecond line\n')this.events.add('pipe-count');return result}
 readSafe(p){try{return this.read(p)}catch{return''}}
 one(raw,stdin){let redir=null;const rm=raw.match(/^(.*?)\s*(>>|>)\s*(\S+)\s*$/);if(rm){raw=rm[1];redir={append:rm[2]==='>>',path:this.path(rm[3])}}
 const a=this.tokens(raw),cmd=a.shift();if(!cmd)return{out:'',code:0};let root=false;if(cmd==='sudo'){const r=this.one(a.filter(x=>x!=='-n').join(' '),stdin);return r}
 let out='';const ev=k=>this.events.add(k),p=x=>this.path(x),req=x=>{const n=this.node(x);if(!n)throw Error(x+': No such file or directory');return n};const data=()=>stdin!==null?stdin:this.read(a[a.length-1]);
 try{
 switch(cmd){
 case 'whoami':out=this.user;ev('identity');break;
 case 'id':{let u=a[0]||this.user;if(!(u in this.users))throw Error('id: no such user');out='uid='+this.users[u]+'('+u+') gid='+this.users[u]+'('+u+') groups='+[u,...Object.keys(this.groups).filter(g=>this.groups[g].includes(u))].join(',');break}
 case 'pwd':out=this.cwd;ev('cwd');break;
 case 'uname':out=a.includes('-r')?'5.14.0-rockylab-simulated':'Linux rocky (educational simulator)';ev('kernel');break;
 case 'hostname':out=this.host;ev('hostname');break;
 case 'hostnamectl':if(a[0]==='set-hostname'){this.host=a[1]}else out='Static hostname: '+this.host+'\nOperating System: Rocky Linux (simulated)';break;
 case 'cd':{let dest=a[0]==='-'?this.prev:p(a[0]);if(!this.fs[dest]?.dir)throw Error('cd: '+dest+': not a directory');this.prev=this.cwd;this.cwd=dest;break}
 case 'ls':{if(a.includes('--help')){out='ls [OPTION]... [FILE]...\n-a include hidden entries; -l long format; -i inode; -d directory itself';ev('ls-help');break}let flags=a.filter(x=>x.startsWith('-')).join(''),target=p(a.find(x=>!x.startsWith('-'))||this.cwd),n=req(target);let paths=n.dir&&!flags.includes('d')?Object.keys(this.fs).filter(x=>x!==target&&x.slice(0,x.lastIndexOf('/'))===(target==='/'?'':target)): [target];if(!flags.includes('a'))paths=paths.filter(x=>!x.split('/').pop().startsWith('.'));out=paths.map(x=>{const f=this.fs[x];return(flags.includes('l')?(f.dir?'d':f.link?'l':'-')+this.rwx(f.mode)+' '+(f.owner||'root')+' '+(f.group||'root')+' ':'')+x.split('/').pop()+(f.link?' -> '+f.link:'')}).join('\n');if(target==='/etc'&&flags.includes('l')&&flags.includes('a'))ev('etc-list');break}
 case 'mkdir':for(const arg of a.filter(x=>!x.startsWith('-'))){let dest=p(arg);if(this.fs[dest]&&!a.includes('-p'))throw Error('mkdir: already exists');const seg=dest.split('/').filter(Boolean);let cur='';for(let i=0;i<seg.length;i++){cur+='/'+seg[i];if(!this.fs[cur]){if(i<seg.length-1&&!a.includes('-p'))throw Error('mkdir: parent does not exist');this.fs[cur]={dir:true,mode:'755',owner:this.user,group:this.user}}else if(!this.fs[cur].dir)throw Error('mkdir: not a directory')}}break;
 case 'touch':for(const arg of a){let dest=p(arg);if(!this.fs[dest]){if(!this.fs[dest.slice(0,dest.lastIndexOf('/'))]?.dir)throw Error('touch: parent does not exist');this.put(dest,'')}}break;
 case 'echo':out=a.join(' ');if(out==='$?')out='0';break;
 case 'cat':out=a.map(x=>this.read(x)).join('');if(a.includes('/etc/os-release'))ev('os');break;
 case 'cp':case 'mv':{if(a.length!==2||a[0].startsWith('-'))throw Error('Simulator supports cp/mv SOURCE DEST for regular files. Use the real lab for recursive copies.');let src=p(a[0]),dest=p(a[1]),n=req(src);if(n.dir)throw Error('source is a directory');if(this.fs[dest]?.dir)dest+='/'+src.split('/').pop();if(!this.fs[dest.slice(0,dest.lastIndexOf('/'))]?.dir)throw Error('destination parent does not exist');this.fs[dest]={...n};if(cmd==='mv')delete this.fs[src];break}
 case 'rm':case 'rmdir':{if(a.some(x=>x.startsWith('-')))throw Error('Simulator: use rm FILE or rmdir EMPTY_DIR; interactive/recursive removal requires the real lab.');for(const arg of a){const path=p(arg),n=req(path);if(!path.startsWith('/home/student/'))throw Error('Simulator only removes entries inside your practice home.');if(n.dir&&(cmd==='rm'||Object.keys(this.fs).some(x=>x.startsWith(path+'/'))))throw Error('directory is not empty or rm needs recursion');delete this.fs[path]}break}
 case 'ln':{if(a[0]!=='-s'||a.length!==3)throw Error('Simulator supports ln -s TARGET LINK. Use a real lab for inode-sharing hard links.');const dest=p(a[2]);if(this.fs[dest])throw Error('link already exists');this.fs[dest]={link:p(a[1]),mode:'777'};break}
 case 'chmod':{if(!/^[0-7]{3,4}$/.test(a[0]))throw Error('Simulator accepts octal modes; symbolic modes require the real lab.');req(a[1]).mode=a[0];break}
 case 'chown':{const [u,g]=a[0].split(':');const n=req(a[1]);n.owner=u;if(g)n.group=g;break}
 case 'chgrp':req(a[1]).group=a[0];break;
 case 'umask':if(a[0])this.mask=a[0];else out=this.mask;break;
 case 'stat':{const n=req(a[a.length-1]);out='File: '+p(a[a.length-1])+'\nAccess: ('+n.mode+') '+this.rwx(n.mode)+'\nSize: '+(n.text?.length||0);break}
 case 'file':out=a.map(x=>x+': '+(req(x).dir?'directory':'ASCII text')).join('\n');break;
 case 'grep':{let opts=a.filter(x=>x.startsWith('-')).join('');let args=a.filter(x=>!x.startsWith('-'));let pat=args[0];let text=stdin!==null?stdin:this.read(args[1]);let re=new RegExp(pat,opts.includes('i')?'i':'');out=text.split('\n').filter((x,i,arr)=>i<arr.length-1||x!=='').map((x,i)=>({x,i})).filter(o=>re.test(o.x)!==opts.includes('v')).map(o=>(opts.includes('n')?o.i+1+':':'')+o.x).join('\n');if(pat==='student'&&args[1]==='/etc/passwd')ev('grep-user');if(!out)return{out:'',code:1};break}
 case 'wc':{const text=data();out=String((text.match(/\n/g)||[]).length);if(!a.includes('-l'))throw Error('Simulator supports wc -l only.');break}
 case 'head':case 'tail':{let n=10;const ni=a.indexOf('-n');if(ni>=0)n=Number(a[ni+1]);let lines=data().replace(/\n$/,'').split('\n');out=(cmd==='head'?lines.slice(0,n):lines.slice(-n)).join('\n');break}
 case 'tee':{let dest=p(a[a.length-1]);this.put(dest,(a.includes('-a')?this.readSafe(dest):'')+(stdin||''));out=stdin||'';break}
 case 'type':out=a.map(x=>x+(x==='cd'?' is a shell builtin':' is /usr/bin/'+x)).join('\n');if(a.includes('cd'))ev('builtin');break;
 case 'which':out=a.map(x=>'/usr/bin/'+x).join('\n');break;
 case 'help':out='Bash built-in help: cd [dir], pwd, history, echo, exit.\nFull built-in documentation is available in the real shell.';break;
 case 'man':out='SIMULATED MANUAL SUMMARY\n'+(a.includes('5')?'passwd(5): name:password:UID:GID:comment:home:shell':'Consult the command library for detailed syntax and examples.');if(a.join(' ')==='5 passwd')ev('manual');break;
 case 'apropos':out='passwd (1) - update authentication tokens\npasswd (5) - password file\nchage (1) - change password expiry information';if(a[0]==='password')ev('apropos');break;
 case 'groupadd':if(this.groups[a[0]])throw Error('group already exists');this.groups[a[0]]=[];break;
 case 'useradd':{const u=a[a.length-1];if(u in this.users)throw Error('user already exists');this.users[u]=1000+Object.keys(this.users).length;this.groups[u]=[];this.fs['/home/'+u]={dir:true,mode:'700'};break}
 case 'usermod':if(a[0]!=='-aG')throw Error('Simulator supports usermod -aG GROUP USER.');if(!this.groups[a[1]]||!(a[2] in this.users))throw Error('unknown group or user');this.groups[a[1]].push(a[2]);break;
 case 'getent':if(a[0]!=='passwd')throw Error('Simulator supports getent passwd USER.');out=this.read('/etc/passwd').split('\n').filter(x=>!a[1]||x.startsWith(a[1]+':')||x.split(':')[2]===a[1]).join('\n');break;
 case 'ps':out='USER      PID %CPU %MEM COMMAND\nroot        1  0.0  0.1 /usr/lib/systemd/systemd\nroot      410  0.0  0.1 /usr/sbin/sshd\nstudent  1020  0.0  0.1 bash';ev('processes');break;
 case 'pgrep':out='410 /usr/sbin/sshd';if(a.includes('sshd'))ev('pgrep');break;
 case 'sleep':if(a[1]!=='&')throw Error('Simulator supports sleep N & for job-control practice.');this.jobList.push({pid:2000+this.jobList.length,command:'sleep '+a[0]});out='['+this.jobList.length+'] '+this.jobList.at(-1).pid;break;
 case 'jobs':out=this.jobList.map((x,i)=>'['+(i+1)+'] Running '+x.command+' &').join('\n');if(this.jobList.length)ev('jobs');break;
 case 'kill':{const pid=Number(a.at(-1));const i=this.jobList.findIndex(x=>x.pid===pid);if(i<0)throw Error('no such practice process');this.jobList.splice(i,1);break}
 case 'systemctl':{const action=a[0],unit=a.filter(x=>!x.startsWith('-')).at(-1).replace(/\.service$/,'');if(action==='get-default'){out='multi-user.target';break}const s=this.services[unit];if(!s)throw Error('Unit not found in simulator. Use the real lab for custom units.');if(unit==='httpd'&&!this.packages.has('httpd'))throw Error('httpd package is not installed');if(action==='status'){out=unit+'.service\nLoaded: loaded; '+(s.enabled?'enabled':'disabled')+'\nActive: '+(s.active?'active (running)':'inactive (dead)');if(unit==='sshd')ev('service-status')}else if(['start','restart','stop'].includes(action))s.active=action!=='stop';else if(['enable','disable'].includes(action)){s.enabled=action==='enable';if(a.includes('--now'))s.active=s.enabled}else if(action==='is-active'){out=s.active?'active':'inactive';if(!s.active)return{out,code:3}}else if(action==='is-enabled'){out=s.enabled?'enabled':'disabled';if(!s.enabled)return{out,code:1}}else if(action==='cat'){out='[Unit]\nDescription=OpenSSH server daemon\n[Service]\nExecStart=/usr/sbin/sshd -D\n[Install]\nWantedBy=multi-user.target';ev('unit-cat')}else throw Error('This systemctl action requires the real lab.');break}
 case 'rpm':{if(a[0]==='-qf'&&a[1]==='/usr/bin/ssh'){out='openssh-clients (simulated version)';ev('rpm-owner')}else if(a[0]==='-q'){if(!this.packages.has(a[1]))throw Error('package '+a[1]+' is not installed');out=a[1]+' (simulated version)';if(a[1]==='bash')ev('rpm-bash');if(a[1]==='httpd')ev('httpd-package')}else if(a[0]==='-qa')out=[...this.packages].join('\n');else throw Error('This RPM query is available in the real lab.');break}
 case 'dnf':if(a[0]==='install'){for(const pkg of a.slice(1).filter(x=>!x.startsWith('-')))this.packages.add(pkg);out='Simulated transaction complete. No real packages were installed.'}else if(a[0]==='repolist')out='baseos    Rocky Linux - BaseOS\nappstream Rocky Linux - AppStream';else throw Error('This DNF operation requires the real lab.');break;
 case 'ip':if(a[0]==='route'){out='default via 192.168.56.1 dev eth0\n192.168.56.0/24 dev eth0 src 192.168.56.10';ev('route')}else if(a.includes('address')||a[0]==='a'){out='lo     UNKNOWN 127.0.0.1/8\neth0   UP      192.168.56.10/24';ev('ip')}else throw Error('Simulator supports ip address and ip route only.');break;
 case 'nmcli':if(a.join(' ')==='connection show --active'){out='NAME         UUID            TYPE      DEVICE\nlab-network  simulated-uuid  ethernet  eth0';ev('nmcli')}else if(a.join(' ')==='device status')out='eth0 ethernet connected lab-network';else throw Error('Network modifications require a real lab.');break;
 case 'journalctl':out=this.logs.join('\n');if(a.includes('sshd'))ev('ssh-logs');break;
 case 'logger':{const i=a.indexOf('-p');if(i>=0)a.splice(i,2);this.logs.push('student: '+a.join(' '));ev('logger');break}
 case 'timedatectl':out='Time zone: Asia/Baghdad\nSystem clock synchronized: yes\nNTP service: active\n(Simulated clock state)';ev('time');break;
 case 'find':{let base=p(a[0]),ni=a.indexOf('-name'),pattern=ni>=0?a[ni+1]:'*';let re=new RegExp('^'+pattern.replace(/[.+^$(){}|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.')+'$');out=Object.keys(this.fs).filter(x=>(x===base||x.startsWith(base+'/'))&&re.test(x.split('/').pop())).join('\n');if(pattern==='*.txt')ev('find-text');break}
 case 'history':out=this.history.map((x,i)=>(i+1)+' '+x).join('\n');break;
 case 'clear':return{out:'',code:0,clear:true};
 case 'date':out=new Date().toString();break;
 case 'exit':out='You are in the local simulator. Switch labs or close this page to leave.';break;
 default:throw Error(cmd+': not implemented in the simulator. Use the command library or connect a real Rocky server.');
 }
 if(redir){const parent=redir.path.slice(0,redir.path.lastIndexOf('/'))||'/';if(!this.fs[parent]?.dir)throw Error('redirect: parent directory does not exist');this.put(redir.path,(redir.append?this.readSafe(redir.path):'')+out+'\n');out=''}
 return{out,code:0}
 }catch(e){return{out:e.message,code:1}}
 }
 rwx(mode='644'){return mode.slice(-3).split('').map(x=>{let n=Number(x);return(n&4?'r':'-')+(n&2?'w':'-')+(n&1?'x':'-')}).join('')}
 check(k){const n=p=>this.fs[this.path(p)];switch(k){case'project-dir':return !!n('~/project/docs')?.dir;case'copy-note':return this.readSafe('~/project/docs/notes.txt')==='Rocky Linux\n'&&this.readSafe('~/project/docs/notes.backup')==='Rocky Linux\n';case'symlink':return n('~/notes-link')?.link==='/home/student/project/docs/notes.txt';case'two-lines':return this.readSafe('~/notes.txt')==='first line\nsecond line\n';case'group-ops':return!!this.groups.ops;case'user-trainee':return'trainee'in this.users;case'membership':return this.groups.ops?.includes('trainee');case'private-report':return n('~/report.txt')?.mode==='600';case'group-read':return n('~/report.txt')?.mode==='640';case'sgid':return n('~/shared')?.mode==='2775';case'web-enabled':return this.services.httpd.active&&this.services.httpd.enabled;case'script-file':return this.readSafe('~/health.sh')==='hostname\n';default:return this.events.has(k)}}
}


