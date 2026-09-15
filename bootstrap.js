try{await import('./app.js?v=20260915');}catch(error){
 console.error('RockyLab startup failed',error);
 const main=document.querySelector('#app');main.replaceChildren();
 const box=document.createElement('section');box.className='page';
 const title=document.createElement('h1');title.textContent='Unable to load the lab / تعذّر تحميل المختبر';
 const detail=document.createElement('p');detail.textContent='Check the connection, then retry. No command was executed. / تحقق من الاتصال ثم أعد المحاولة. لم يُنفّذ أي أمر.';
 const retry=document.createElement('button');retry.textContent='Retry / إعادة المحاولة';retry.onclick=()=>location.reload();
 box.append(title,detail,retry);main.append(box);
}

