/* One node of the mind map. Text stays selectable for translation and questions. */
(() => {
  'use strict';
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
  const t=(zh,en)=>window.ReaderLanguage?.current==='en'?en:zh;
  function tap(cls,text,fn){const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b}
  function rich(node,text){
    for(const part of String(text).split(/(\*\*[^*]+\*\*)/)){
      if(part.startsWith('**'))node.append(el('b','',part.slice(2,-2)));
      else if(part)node.append(document.createTextNode(part));
    }
  }
  function words(n,line){
    if(n.zh)PaperUI.set(line,n.zh,n.en);
    else if(/[㐀-鿿]/.test(n.text)){rich(line,n.text);line.dataset.sourceText=''}
    else PaperLanguageText.bind(line,n.text.replace(/\*\*/g,''));
  }
  function evidence(n,source){
    if(n.page&&!n.root&&n.quote){
      const miss=n.check==='miss';
      const scope=n.check==='scope';
      const b=tap('mm-page',scope?t('图号待核对 · p.','Check figure · p.')+n.page:miss?t('待核对','Unverified'):'p.'+n.page,()=>source(n.page,miss?'':n.quote));
      b.dataset.check=n.check||'';
      b.title=(scope?t('已找到原句，请核对它所指的图。','Quotation located. Check which figure it refers to. '):'')+n.quote;
      return b;
    }
    if(n.check==='miss'){const tag=el('span','mm-page',t('待核对','Unverified'));tag.title=n.quote;tag.dataset.check='miss';return tag}
    if(n.check==='none'){const s=el('span','mm-page',t('没有附依据','No source'));s.dataset.check='none';return s}
    return null;
  }
  function build(n,{figure,name,source,panel,thumb,refs,fold}){
    const box=el('div','mm-node mm-d'+Math.min(n.depth,3)),body=el('div','mm-words'),line=el('span','mm-text');
    box.style.setProperty('--branch',n.color);
    if(n.fig&&!n.short){
      const pic=tap('mm-thumb','',()=>figure(n.fig)),img=el('img');
      img.alt='';pic.append(img);pic.setAttribute('aria-label',t('打开这张图','Open this figure'));box.append(pic);
      Promise.resolve(thumb(n.fig)).then(src=>{if(src)img.src=src},()=>{});
    }
    if(n.role){
      const r=el('i','mm-role');
      const roles={context:['研究背景','Context'],prior:['已有证据','Prior evidence'],gap:['待解问题','Open question'],challenge:['研究难点','Challenge'],
        reviewAim:['综述目的','Review aim'],scope:['讨论范围','Scope'],translationBarrier:['转化难点','Translational barrier'],
        aim:['研究目的','Objective'],question:['具体问题','Specific question'],why:['为什么做','Why'],found:['作者的说法','Authors say'],joint:['多图合引','Joint figure reference']};
      PaperUI.set(r,...(roles[n.role]||roles.found));body.append(r);
    }
    if(n.fig)body.append(tap('mm-fig',name(n.fig),()=>figure(n.fig)));
    if(n.panel)body.append(tap('mm-fig',n.panel,()=>panel(n.fig||n.parent?.fig,n.panel)));
    words(n,line);body.append(line);
    const proof=evidence(n,source);if(proof)body.append(proof);
    const count=n.fig&&!n.short?refs(n.fig):0;
    if(count)body.append(el('small','mm-refs',t(count+' 篇文献',count+' references')));
    box.append(body);
    if(n.children?.length&&!n.root){
      const dot=tap('mm-dot','',fold);dot.setAttribute('aria-label',t('收起或展开这一支','Fold or unfold'));box.append(dot);
    }
    return box;
  }
  window.ReadingMapNode=Object.freeze({build});
})();
