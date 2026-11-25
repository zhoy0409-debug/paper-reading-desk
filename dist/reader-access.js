/* Transport and connection controls shared by the hosted reader and the loopback edition. */
(() => {
  'use strict';
  const local=location.hostname==='127.0.0.1';
  const pair=(tag,zh,en)=>PaperUI.set(document.createElement(tag),zh,en);
  async function localAPI(path,body,signal){
    const init=body===undefined?{signal}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal};
    const res=await fetch('/api/'+path,init);
    if(!res.ok)throw Error('Reading service unavailable');
    return res.json();
  }
  async function search(query,signal){
    if(local)return localAPI('literature-search',{query},signal);
    const empty=status=>({literature:[],search:{status,query,count:0}});
    if(!query.trim())return empty('no_query');
    const url=new URL('https://api.crossref.org/works');
    url.search=new URLSearchParams({'query.bibliographic':query.slice(0,120),rows:'5',select:'DOI,title,published,abstract'});
    const controller=new AbortController();
    const abort=()=>controller.abort();
    if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,8000);
    try{
      const res=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!res.ok)throw Error();
      const json=await res.json();const literature=[];
      for(const item of json.message.items){
        if(!/^10\.\d{4,9}\//i.test(item.DOI)||!item.title?.[0])continue;
        const plain=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
        literature.push({id:'L'+(literature.length+1),title:plain(item.title[0]).slice(0,350),url:'https://doi.org/'+item.DOI,
          year:item.published?.['date-parts']?.[0]?.[0]||'',abstract:plain(item.abstract).slice(0,1600)});
      }
      return {literature,search:{query,count:literature.length,status:literature.length?'ok':'no_results'}};
    }catch(err){if(signal?.aborted)throw err;return empty('unavailable');}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  function connections(container,provider,updated){
    if(!local){
      const a=pair('a','在阅读器内连接模型 · 获取本机版','Connect a model in the local edition');
      a.href='https://github.com/zhoy0409-debug/paper-reading-desk/releases/latest';a.target='_blank';a.rel='noopener noreferrer';
      container.append(a);return;
    }
    const settings=document.createElement('details');settings.className='access-keys';
    settings.append(pair('summary','连接自己的模型','Connect a model'));
    const which=document.createElement('select');
    for(const [key,zh,en] of [['deepseek','DeepSeek','DeepSeek'],['qwen','通义千问 · 北京','Qwen · Beijing']]){
      const op=pair('option',zh,en);op.value=key;which.append(op);
    }
    const name=pair('label','服务','Provider');name.append(which);
    const label=pair('label','本次运行的 API 密钥','API key for this session');
    const token=document.createElement('input');token.type='password';token.autocomplete='off';token.spellcheck=false;token.maxLength=512;label.append(token);
    const save=pair('button','使用密钥','Use key'),forget=pair('button','移除本次密钥','Remove session key'),help=pair('a','获取 API 密钥','Get an API key');
    save.type=forget.type='button';help.target='_blank';help.rel='noopener noreferrer';
    function service(){token.value='';help.href=which.value==='deepseek'?'https://platform.deepseek.com/api_keys':'https://help.aliyun.com/en/model-studio/get-api-key';}
    which.onchange=service;service();
    provider.addEventListener('change',()=>{
      const selected=provider.selectedOptions[0];
      if(!selected || selected.dataset.needsKey!=='true' || !['qwen','deepseek'].includes(selected.value))return;
      which.value=selected.value;service();container.open=true;settings.open=true;token.focus();
    });
    settings.addEventListener('toggle',()=>{if(!settings.open)token.value='';});
    const status=document.createElement('small');status.setAttribute('role','status');
    async function update(remove){
      const key=remove?'':token.value.trim();if(!remove&&!key){token.focus();return;}
      save.disabled=forget.disabled=which.disabled=true;
      try{
        const config=await localAPI('model-session',{provider:which.value,key});
        token.value='';if(!remove)provider.value=which.value;
        updated(config);provider.dispatchEvent(new Event('change'));
        PaperUI.set(status,remove?'本次密钥已移除。':'已保存到本次运行，可直接提问。',remove?'Session key removed.':'Key set for this session. You can ask a question.');
      }catch{PaperUI.set(status,'未能保存，请检查本机服务。','Could not save the key. Check the local reader.');}
      finally{save.disabled=forget.disabled=which.disabled=false;}
    }
    save.onclick=()=>update(false);forget.onclick=()=>update(true);
    settings.append(name,label,save,forget,help,status);container.append(settings);
  }
  function webChat(container,context){
    const d=document.createElement('details');d.className='access-web';
    d.append(pair('summary','用已有的网页版 AI 继续问','Continue in a web AI chat'));
    const copy=pair('button','复制问题与原文','Copy question and passages');copy.type='button';
    const msg=document.createElement('small');msg.setAttribute('role','status');
    const fallback=document.createElement('textarea');fallback.readOnly=true;fallback.hidden=true;
    d.append(pair('p','先复制，再打开你常用的服务粘贴。','Copy the question, then paste it in your usual chat.'),copy,msg,fallback);
    for(const [label,url] of [['ChatGPT','https://chatgpt.com/'],['DeepSeek','https://chat.deepseek.com/'],['Claude','https://claude.ai/'],['Gemini','https://gemini.google.com/']]){
      const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';d.append(a);
    }
    copy.onclick=async()=>{
      const value=context();
      if(!value){PaperUI.set(msg,'请先输入问题。','Enter a question first.');return;}
      try{await navigator.clipboard.writeText(value);fallback.hidden=true;PaperUI.set(msg,'已复制。','Copied.');}
      catch{fallback.value=value;fallback.hidden=false;fallback.focus();fallback.select();PaperUI.set(msg,'请复制选中的文字。','Copy the selected text.');}
    };
    container.append(d);
  }
  window.ReaderAccess={local,search,connections,webChat,
    options:()=>local?localAPI('reading-options'):Promise.resolve({automatic:'evidence',available:{evidence:true}}),
    outline:(body,signal)=>localAPI('reading-outline',body,signal),
    ask:async(body,signal)=>{
      if(local)return localAPI('reading-question',body,signal);
      const result=body.searchPublic?await search(body.query,signal):{literature:[],search:{status:'off'}};
      return {...result,provider:'evidence'};
    }};
})();
