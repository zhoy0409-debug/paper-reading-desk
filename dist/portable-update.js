/* Only the portable loopback service exposes installation controls. */
(async () => {
  if (location.hostname !== '127.0.0.1') return;
  const endpoint='/api/portable-update';
  const request=async(action)=>{
    const response=await fetch(endpoint,action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})}:{cache:'no-store'});
    if(!response.ok)throw Error('Update service unavailable');
    return response.json();
  };
  let state;
  try {state=await request();} catch {return;}
  if(!state.enabled)return;
  const header=document.querySelector('header.top');
  const panel=document.createElement('details');panel.className='portable-update';
  const summary=document.createElement('summary'),box=document.createElement('div'),status=document.createElement('p'),button=document.createElement('button');
  box.className='portable-update-box';status.setAttribute('role','status');button.type='button';
  box.append(status,button);panel.append(summary,box);
  const languages=header.querySelector('[data-language-switch]');
  if(languages)languages.before(panel);else header.append(panel);
  const phases={
    idle:['检查更新','Check for updates'],checking:['正在检查新版…','Checking for updates…'],
    current:['已是最新版','Up to date'],available:['有新版本','Update available'],
    downloading:['正在下载','Downloading'],verifying:['正在校验并安装…','Verifying and installing…'],
    ready:['新版已安装，重启后生效。','Update installed. Restart to apply it.'],
    restarting:['正在重启阅读器…','Restarting Reading Desk…'],error:['更新未完成，可重试。','Update could not finish. Try again.'],
    refreshed:['新版已启动。可刷新界面继续。','The update is running. Reload the interface when ready.'],
    rollback:['新版未能启动，已返回原版本。','The update could not start. The previous version is running.']
  };
  const actions={check:['检查更新','Check for updates'],install:['下载安装','Download and install'],restart:['重启并应用','Restart to apply'],reload:['刷新界面','Reload interface']};
  const localized=(words)=>ReaderLanguage.choose(...words);
  let timer=0,restartFrom='',sending=false;
  function nextAction(){
    if(state.phase==='error')return state.operation==='install'?'install':'check';
    return ({idle:'check',current:'check',available:'install',ready:'restart',refreshed:'reload',rollback:'check'})[state.phase];
  }
  function draw(){
    summary.textContent=localized(state.phase==='available'?['有更新','Update available']:['版本更新','Updates']);
    const progress=state.phase==='downloading'&&state.total?' '+Math.floor(100*state.received/state.total)+'%':'';
    const number=state.phase==='available'?' v'+state.latest:'';
    status.textContent='v'+state.current+' · '+localized(phases[state.phase]||phases.idle)+number+progress;
    const action=nextAction();button.hidden=!action;
    if(action)button.textContent=localized(actions[action]);button.disabled=sending;
  }
  async function poll(){
    try{
      const result=await request();
      if(restartFrom && result.phase!=='restarting'){
        if(result.current!==restartFrom&&!document.querySelector('.ea-node,.pm-node')){location.reload();return;}
        result.phase=result.current===restartFrom?'rollback':'refreshed';restartFrom='';
      }
      state=result;
    }catch{if(!restartFrom){state={...state,phase:'error',operation:'check'};}}
    draw();schedule();
  }
  function schedule(){
    clearTimeout(timer);
    if(restartFrom||['checking','downloading','verifying','restarting'].includes(state.phase))timer=setTimeout(poll,1000);
  }
  async function run(action){
    if(sending)return;
    if(action==='reload'){location.reload();return;}
    sending=true;draw();
    try{state=await request(action);if(action==='restart'&&state.phase==='restarting')restartFrom=state.current;}
    catch{state={...state,phase:'error',operation:action};}
    finally{sending=false;draw();schedule();}
  }
  button.onclick=()=>run(nextAction());
  document.addEventListener('reader-language-change',draw);
  document.addEventListener('click',e=>{if(!panel.contains(e.target))panel.open=false});
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.open=false;summary.focus()}});
  draw();if(state.phase==='idle')run('check');else schedule();
})();
