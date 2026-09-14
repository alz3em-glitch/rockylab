import {PracticeShell as BaseShell} from './simulator.js';
// Additional deterministic exercises. All data remains inside the browser.
export class PracticeShell extends BaseShell {
 reset(){super.reset();this.archives={};this.locateIndex=Object.keys(this.fs);this.timezone='Etc/UTC';this.ntp=false;this.vms={'rocky-test':'shut off'};}
 one(raw,stdin=null){
  const redirected=this.split(raw,['2>>','2>','>>','>','<']);
  if(redirected.length>1){
   if(redirected.length!==3)return{out:'This combination of redirects requires the real shell. Practice one redirect at a time.',code:2};
   const [command,op,destination]=redirected,args=this.tokens(destination.trim());
   if(args.length!==1)return{out:'Redirect requires one destination path.',code:2};
   const path=this.path(args[0]);
   try{if(op==='<')return this.one(command,this.read(path));
    const result=this.one(command,stdin),error=op.startsWith('2'),content=error?(result.code?result.out:''):(result.code?'':result.out);
    if(path!=='/dev/null'){if(!this.node(path.slice(0,path.lastIndexOf('/'))||'/')?.dir)throw Error('Redirect parent does not exist');this.put(path,(op.endsWith('>>')?this.readSafe(path):'')+content+(content&&!content.endsWith('\n')?'\n':''));}
    return{out:error?(result.code?'':result.out):(result.code?result.out:''),code:result.code};
   }catch(e){return{out:e.message,code:1};}
  }
  const words=this.tokens(raw),command=words[0]==='sudo'?words[1]:words[0];
  const args=words.slice(words[0]==='sudo'?2:1).filter(x=>x!=='-n');
  let out='',handled=true;
  try{switch(command){
   case 'cut':{const d=args[args.indexOf('-d')+1],fields=args[args.indexOf('-f')+1].split(',').map(Number),text=stdin??this.read(args.at(-1));out=text.trimEnd().split('\n').map(line=>fields.map(n=>line.split(d)[n-1]??'').join(d)).join('\n');if(d===':'&&fields.includes(1)&&args.at(-1)==='/etc/passwd')this.events.add('cut-users');break;}
   case 'sort':{const text=stdin??this.read(args.at(-1));let rows=text.trimEnd().split('\n').sort(args.includes('-n')?(a,b)=>Number(a)-Number(b):undefined);if(args.includes('-r'))rows.reverse();if(args.includes('-u'))rows=[...new Set(rows)];out=rows.join('\n');break;}
   case 'uniq':{const rows=(stdin??this.read(args.at(-1))).trimEnd().split('\n'),groups=[];for(const row of rows){if(groups.at(-1)?.row===row)groups.at(-1).n++;else groups.push({row,n:1})}out=groups.map(x=>(args.includes('-c')?x.n+' ':'')+x.row).join('\n');if(out===this.read('/etc/passwd').trimEnd().split('\n').map(x=>x.split(':')[0]).sort().join('\n'))this.events.add('unique-users');break;}
   case 'tar':{const flags=args[0]?.replace(/^-/,'')||'',fi=args.indexOf('-f'),archive=args[fi>=0?fi+1:1];if(!flags.includes('f')&&fi<0)throw Error('tar: specify an archive with -f');const path=this.path(archive),ci=args.indexOf('-C'),base=ci>=0?this.path(args[ci+1]):this.cwd;
    if(flags.includes('c')){const targets=args.slice(2).filter((x,i,all)=>x!=='-C'&&all[i-1]!=='-C');if(!targets.length)throw Error('tar: no input paths');const entries={};for(const target of targets){const full=target.startsWith('/')?this.path(target):this.path(base+'/'+target);if(!this.node(full))throw Error(target+': No such file');for(const key of Object.keys(this.fs).filter(x=>x===full||x.startsWith(full+'/')))entries[target.replace(/^\/+|\/$/g,'')+key.slice(full.length)]={...this.fs[key]};}this.archives[path]=entries;this.put(path,'[SIMULATED ARCHIVE: '+Object.keys(entries).join(', ')+']');}
    else if(flags.includes('t')){if(!this.archives[path])throw Error('Not a simulated archive');out=Object.keys(this.archives[path]).join('\n');if(path===this.path('~/project.tar.gz'))this.events.add('archive-list');}
    else if(flags.includes('x')){if(!this.archives[path])throw Error('Archive does not exist');if(!this.node(base)?.dir)throw Error('Extraction directory does not exist');for(const [member,node]of Object.entries(this.archives[path])){const dest=this.path(base+'/'+member);if(!dest.startsWith(base+'/'))throw Error('Archive member leaves extraction directory');this.fs[dest]={...node};}}
    else throw Error('Supported tar actions: create (-c), list (-t), extract (-x)');break;}
   case 'du':{const target=this.path(args.find(x=>!x.startsWith('-'))||'.');if(!this.node(target))throw Error('Path not found');out=Math.ceil(Object.entries(this.fs).filter(([p])=>p===target||p.startsWith(target+'/')).reduce((n,[,v])=>n+(v.text?.length||0),0)/1024)+'K\t'+target;this.events.add('du-inspect');break;}
   case 'df':out=args.includes('-i')?'Filesystem Inodes IUsed IFree IUse% Mounted on\n/dev/vda2 524288 18000 506288 4% /':'Filesystem Size Used Avail Use% Mounted on\n/dev/vda2 20G 4G 16G 20% /';this.events.add(args.includes('-i')?'inodes':'capacity');break;
   case 'lsblk':out='NAME FSTYPE UUID MOUNTPOINTS\nvda\n└─vda2 xfs lab-root-uuid /\nsr0 iso9660 lab-media-uuid';this.events.add('disks');if(args.includes('-f'))this.events.add('disk-types');break;
   case 'findmnt':out='TARGET SOURCE FSTYPE OPTIONS\n/ /dev/vda2 xfs rw,relatime';if(args[0]==='/')this.events.add('rootmount');break;
   case 'blkid':out='/dev/vda2: UUID="lab-root-uuid" TYPE="xfs"\n/dev/sr0: UUID="lab-media-uuid" TYPE="iso9660"';break;
   case 'updatedb':this.locateIndex=Object.keys(this.fs);break;
   case 'locate':{const limit=args.includes('-n')?Number(args[args.indexOf('-n')+1]):Infinity,pattern=args.at(-1),insensitive=args.includes('-i');out=this.locateIndex.filter(x=>insensitive?x.toLowerCase().includes(pattern.toLowerCase()):x.includes(pattern)).slice(0,limit).join('\n');if(!out)return{out:'',code:1};break;}
   case 'tty':out='/dev/pts/0 (simulated)';break;
   case 'uptime':out='10:30:00 up 2 days, 1 user, load average: 0.08, 0.05, 0.01';break;
   case 'w':out='USER TTY FROM LOGIN@ IDLE WHAT\nstudent pts/0 browser 10:00 0s bash';break;
   case 'top':out='SIMULATED SNAPSHOT — no live kernel is running\n'+super.one('ps aux',null).out;break;
   case 'pstree':out='systemd─┬─sshd\n        └─bash';break;
   case 'arch':out='x86_64';break;
   case 'lsmod':out='Module Size Used by\nkvm_intel 364544 0\nkvm 1064960 1 kvm_intel';break;
   case 'timedatectl':if(args[0]==='set-timezone'){if(!['Asia/Baghdad','Etc/UTC','UTC'].includes(args[1]))throw Error('Practice zones: Asia/Baghdad, Etc/UTC');this.timezone=args[1];}else if(args[0]==='set-ntp'){if(!['true','false'].includes(args[1]))throw Error('Use true or false');this.ntp=args[1]==='true';}else if(args[0]==='list-timezones')out='Asia/Baghdad\nEtc/UTC';else{out='Time zone: '+this.timezone+'\nNTP service: '+(this.ntp?'active':'inactive')+'\nEducational clock state';this.events.add('time');}break;
   default:handled=false;
  }
  return handled?{out,code:0}:super.one(raw,stdin);
  }catch(e){return{out:e.message,code:1};}
 }
 check(key){switch(key){
  case 'archive':return !!this.archives[this.path('~/project.tar.gz')];
  case 'restore':return !!this.node('~/restore/project/docs/notes.txt')&&this.readSafe('~/restore/project/docs/notes.txt')===this.readSafe('~/project/docs/notes.txt');
  default:return super.check(key);
 }}
}

