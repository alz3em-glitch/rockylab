import {PracticeShell as FileShell} from './practical-shell.js';
// State-based training models, never network connections or OS commands.
export class PracticeShell extends FileShell {
 reset(){super.reset();this.acls={};this.enforcement='Enforcing';this.firewall={zone:'public',services:['ssh','dhcpv6-client']};this.services.firewalld={active:true,enabled:true};this.services.chronyd={active:true,enabled:true};this.services.libvirtd={active:true,enabled:true};this.services['virtqemud.socket']={active:true,enabled:true};this.services['vncserver@:1']={active:true,enabled:true};this.packages.add('tigervnc-server');this.remoteHost={name:'lab-b',user:'student',port:22};this.fs['/var/www']={dir:true,mode:'755'};this.fs['/var/www/html']={dir:true,mode:'755',label:'httpd_sys_content_t'};}
 one(raw,stdin=null){
  if(/^sudo\s/.test(raw))return this.one(raw.replace(/^sudo\s+(?:-n\s+)?/,''),stdin);
  if(this.split(raw,['>','<']).length>1)return super.one(raw,stdin);
  const a=this.tokens(raw),cmd=a.shift();let out='';const event=k=>this.events.add(k);
  try{switch(cmd){
   case 'getfacl':{const path=this.path(a.at(-1)),node=this.node(path);if(!node)throw Error('getfacl: file does not exist');out='# file: '+path+'\nuser::rw-\ngroup::r--\nother::---'+(this.acls[path]?'\n'+this.acls[path]+'\nmask::r--':'');event('acl-read');if(this.acls[path]==='user:trainee:r--')event('acl-verify');break;}
   case 'setfacl':{if(a[0]!=='-m'||a[1]!=='u:trainee:r')throw Error('Practice syntax: setfacl -m u:trainee:r FILE');const path=this.path(a[2]);if(!this.node(path)||!('trainee'in this.users))throw Error('Create the file and trainee account first');this.acls[path]='user:trainee:r--';break;}
   case 'getenforce':out=this.enforcement;event('selinux-mode');break;
   case 'restorecon':{if(!a.includes('-nRv')||!this.node(a.at(-1)))throw Error('Practice: restorecon -nRv /var/www/html');out='Would relabel /var/www/html to system_u:object_r:httpd_sys_content_t:s0 (preview)';event('selinux-preview');break;}
   case 'firewall-cmd':{if(!this.services.firewalld.active)throw Error('FirewallD is not running');if(a.includes('--get-active-zones')){out=this.firewall.zone+'\n  interfaces: eth0';event('fw-zones');}else if(a.includes('--list-services')){out=this.firewall.services.join(' ');event(a.includes('--permanent')?'fw-permanent':'fw-services');}else throw Error('Practice supports --get-active-zones and [--permanent] --list-services');break;}
   case 'pvs':out='PV VG Fmt Attr PSize PFree\n/dev/vda3 rl lvm2 a-- 18g 2g';event('pvs');break;
   case 'vgs':out='VG #PV #LV #SN Attr VSize VFree\nrl 1 2 0 wz--n- 18g 2g';event('vgs');break;
   case 'lvs':out='LV VG Attr LSize\nroot rl -wi-ao---- 14g\nswap rl -wi-ao---- 2g';event('lvs');break;
   case 'swapon':if(!a.includes('--show'))throw Error('Practice: swapon --show');out='NAME TYPE SIZE USED PRIO\n/dev/dm-1 partition 2G 0B -2';if(this.events.has('lvs'))event('lvs-swap');break;
   case 'crontab':if(a[0]!=='-l')throw Error('Practice: crontab -l');out='0 2 * * * /home/student/backup.sh';event('cron');break;
   case 'chronyc':if(a[0]!=='sources')throw Error('Practice: chronyc sources -v');out='MS Name/IP address Stratum Poll Reach LastRx Last sample\n^* training-time 2 6 377 20 +15us[+20us] +/- 2ms\nSimulated source; no NTP traffic.';event('chrony');break;
   case 'bash':{const path=a.at(-1),body=this.read(path);if(body.trim()!=='hostname')throw Error('This exercise supports a script containing hostname. Other Bash programs require a real shell.');if(a.includes('-n'))event('script-syntax');else{out=this.host;event('script-run');}break;}
   case '/usr/sbin/sshd':case 'sshd':if(a[0]!=='-t')throw Error('Practice: sshd -t');event('ssh-config');break;
   case 'ss':if(!a.some(x=>x.includes('l')))throw Error('Practice: ss -tlnp');out='State Recv-Q Send-Q Local Address:Port Peer Address:Port Process\nLISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=410))\nLISTEN 0 5 127.0.0.1:5901 0.0.0.0:* users:(("Xvnc",pid=900))';event('ssh-listen');break;
   case 'ssh':{const target=a.find(x=>x==='lab-b'||x==='student@lab-b');if(!target)throw Error('Simulation has one destination: lab-b. Other hosts require My servers.');const remote=a.at(-1);if(remote!=='whoami; hostname; echo SSH_OK')throw Error('Practice: ssh -o BatchMode=yes lab-b "whoami; hostname; echo SSH_OK"');out='student\nlab-b\nSSH_OK\n[Simulated remote command; no network connection]';event('ssh-remote');break;}
   case 'curl':if(!a.includes('-I')||!a.includes('http://127.0.0.1'))throw Error('Practice: curl -I http://127.0.0.1');if(!this.services.httpd.active)throw Error('curl: connection refused — start httpd');out='HTTP/1.1 200 OK\nServer: Apache (simulated)';event('cap-http');break;
   case 'journalctl':{const unit=a.includes('-u')?a[a.indexOf('-u')+1].replace(/\.service$/,''):null;let rows=this.logs.filter(x=>!unit||x.startsWith(unit+':'));const ni=a.indexOf('-n');if(ni>=0)rows=rows.slice(-Number(a[ni+1]));out=rows.join('\n')||'-- No entries --';if(unit==='sshd')event('ssh-logs');if(unit==='httpd'&&rows.length)event('cap-logs');break;}
   case 'virsh':if(!a.includes('list')||!a.includes('--all'))throw Error('Practice: virsh -c qemu:///system list --all');out='Id Name State\n- rocky-test shut off';event('vm-inventory');break;
   default:{
    if(cmd==='systemctl'&&a[0]==='list-timers'){event('timers');return{out:'NEXT LEFT LAST PASSED UNIT ACTIVATES\n02:00 8h 02:00 16h backup.timer backup.service',code:0};}
    if(cmd==='ls'&&a.includes('-Zd')){if(!this.node(a.at(-1)))throw Error('Path does not exist');event('selinux-label');return{out:'drwxr-xr-x root root system_u:object_r:httpd_sys_content_t:s0 '+a.at(-1),code:0};}
    const r=super.one(raw,stdin);if(r.code===0){if(cmd==='systemctl'&&['start','stop','restart','enable','disable'].includes(a[0])){const unit=a.at(-1).replace(/\.service$/,'');this.logs.push(unit+': '+a[0]+' completed');}if(cmd==='lsmod')event('kvm-modules');if(cmd==='grep'&&a.includes('kvm')&&r.out.includes('kvm'))event('kvm-inspect');if(cmd==='systemctl'&&a[0]==='status'&&['virtqemud.socket','libvirtd'].includes(a[1]))event('vm-daemon');if(cmd==='rpm'&&a[0]==='-q'&&a.includes('tigervnc-server'))event('vnc-package');if(cmd==='systemctl'&&a[0]==='status'&&a[1]==='vncserver@:1.service')event('vnc-service');if(cmd==='grep'&&a.includes('5901')&&r.out.includes('LISTEN'))event('vnc-listener');}return r;
   }
  }return{out,code:0};}catch(e){return{out:e.message,code:1};}
 }
 check(key){if(key==='acl-grant')return this.acls[this.path('~/report.txt')]==='user:trainee:r--';if(key==='cap-service')return this.packages.has('httpd')&&this.services.httpd.active&&this.services.httpd.enabled;return super.check(key);}
}

