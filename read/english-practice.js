/* English listening and speaking beside the current figure. */
(() => {
  'use strict';
  const acs = 'https://www.acs.org/pressroom/chain-reaction/antibiotics.html';
  // The ACS episode and its authorized Tiny Matters rebroadcast use the same edit.
  const recordings = [
    'https://rss.art19.com/episodes/02de42fa-c1ea-4943-a6f3-633d5f10cd1e.mp3',
    'https://www.buzzsprout.com/2599310/episodes/19632903.mp3'
  ];
  const clip = {start:2403.5, end:2410.5};
  const discovery = 'https://pubmed.ncbi.nlm.nih.gov/37231267/';
  const english = text => typeof text === 'string' && /[a-z]/i.test(text) && !/\p{Script=Han}/u.test(text);
  const tidy = text => String(text || '').replace(/\s+/g, ' ').trim();
  function sentenceOf(text, selected = '') {
    const clean = tidy(text);
    if (!english(clean)) return '';
    const sentences = typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter('en', {granularity:'sentence'}).segment(clean)].map(s=>s.segment.trim())
      : clean.split(/(?<=[!?\.])\s+(?=[A-Z])/);
    const term = tidy(selected).toLowerCase();
    const match = sentences.find(s=>term && s.toLowerCase().includes(term));
    return (match || sentences[0] || '').slice(0, 900);
  }
  function selectionSentence(anchor, selection) {
    const p = anchor?.closest('p,dd,blockquote,figcaption,td,li,h1,h2,h3,h4');
    return p && !p.closest('.rq-ask') ? sentenceOf(p.textContent, selection) : '';
  }
  const make = (tag, cls) => { const e=document.createElement(tag); if(cls)e.className=cls;return e; };
  const label = (e,zh,en) => PaperUI.set(e,zh,en);
  function button(zh,en,fn) {
    const b=label(make('button'),zh,en); b.type='button'; b.onclick=fn; return b;
  }
  function link(zh,en,href) {
    const a=label(make('a'),zh,en); a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;
  }
  const box = make('dialog','english-practice');
  box.setAttribute('aria-labelledby','practice-heading');
  const top=make('div','ep-top'), title=label(make('h2'),'英文跟读','English practice');
  title.id='practice-heading';
  const dismiss=button('关闭','Close',()=>box.close());
  top.append(title,dismiss);
  const scope=make('small','ep-scope');scope.dataset.sourceText='';
  const field=make('input');field.type='text';field.maxLength=900;field.dir='ltr';field.lang='en';field.id='ep-text';field.autocomplete='off';
  const fieldName=label(make('label'),'术语或英文原句','Term or English passage');fieldName.htmlFor=field.id;
  const sources=make('div','ep-sources');
  const termActions=make('div','ep-actions'), example=make('section','ep-sentence'), follow=make('div','ep-follow');
  const sentenceLabel=make('h3'), sentence=make('p'); sentence.lang='en';sentence.dataset.sourceText='';
  const exampleActions=make('div','ep-actions');
  example.append(sentenceLabel,sentence,exampleActions);
  const status=make('p','ep-status');status.setAttribute('role','status');
  const viva=make('details','ep-viva');
  const vivaQ=make('p'),vivaA=make('p');
  for(const p of [vivaQ,vivaA]){p.lang='en';p.dataset.sourceText='';}
  vivaQ.textContent='Why is abaucin described as narrow-spectrum?';
  vivaA.textContent='It inhibited Acinetobacter baumannii while showing little activity against the other species tested.';
  const vivaButtons=make('div','ep-actions');
  vivaButtons.append(button('听问题','Hear the question',()=>speak(vivaQ.textContent,1)),button('听回答','Hear the answer',()=>speak(vivaA.textContent,1)));
  viva.append(label(make('summary'),'练一道英文答辩题','Rehearse a journal-club question'),vivaQ,vivaA,vivaButtons);
  box.append(top,scope,fieldName,field,sources,termActions,example,viva,follow,status);document.body.append(box);
  let context={},origin,player,utterance,serial=0,expectedSentence='',playing=false;
  function message(zh,en){label(status,zh,en);}
  function stop(){
    serial++;
    if(player){player.pause();player.removeAttribute('src');player.load();player=null;}
    if(utterance){window.speechSynthesis?.cancel();utterance=null;}
    playing=false;halt.hidden=true;status.replaceChildren();
  }
  const halt=button('停止播放','Stop playback',()=>{stop();message('已停止。','Playback stopped.');});halt.hidden=true;
  top.insertBefore(halt,dismiss);
  function playbackError(){
    stop();
    message('播放未完成。可重试听，或打开下方的发音来源。','Playback was interrupted. Retry or open a pronunciation source.');
  }
  function speak(text,rate){
    stop();
    if(!english(text))return;
    const synth=window.speechSynthesis;
    if(!synth || typeof window.SpeechSynthesisUtterance!=='function'){
      message('此浏览器未提供英文朗读。可用词典或作者访谈听发音。','Speech synthesis is unavailable in this browser. Use the dictionary or interview for pronunciation.');return;
    }
    const voices=synth.getVoices(), candidates=voices.filter(v=>/^en(?:[-_]|$)/i.test(v.lang));
    if(voices.length && !candidates.length){
      message('请在系统语音设置中添加英语语音，或打开词典查听。','Add an English voice in your system speech settings or check the dictionary.');return;
    }
    const u=new SpeechSynthesisUtterance(text),id=serial;
    const voice=candidates.find(v=>v.localService && /^en-US$/i.test(v.lang)) || candidates.find(v=>v.localService) || candidates[0];
    if(voice)u.voice=voice;
    u.lang=voice?.lang || 'en-US';u.rate=rate;utterance=u;halt.hidden=false;
    u.onstart=()=>{if(serial===id){playing=true;message('正在播放合成示范…','Playing synthesized speech…');}};
    u.onend=()=>{if(serial===id)stop();};u.onerror=()=>{if(serial===id)playbackError();};
    message('正在准备英文语音…','Preparing the English voice…');
    try{synth.speak(u);}catch{playbackError();return;}
    setTimeout(()=>{if(serial===id&&!playing)playbackError();},10000);
  }
  function authorAudio(rate=1,sourceIndex=0){
    stop();
    const audio=new Audio(), id=serial;player=audio;audio.preload='none';audio.defaultPlaybackRate=rate;halt.hidden=false;
    audio.src=recordings[sourceIndex]+'#t='+clip.start+','+clip.end;
    audio.playbackRate=rate;
    audio.onloadedmetadata=()=>{
      if(serial!==id)return;
      audio.playbackRate=rate;
      if(Math.abs(audio.currentTime-clip.start)>1)audio.currentTime=clip.start;
    };
    audio.ontimeupdate=()=>{if(serial===id && audio.currentTime>=clip.end)stop();};
    audio.onpause=()=>{if(serial===id && audio.currentTime>=clip.end-.2)stop();};
    audio.onplaying=()=>{if(serial===id)message('正在播放 Jon Stokes 的原声。','Playing Jon Stokes’s original recording.');};
    const failed=()=>{
      if(serial!==id)return;
      if(sourceIndex+1<recordings.length)authorAudio(rate,sourceIndex+1);
      else playbackError();
    };
    audio.onended=()=>{if(serial===id)stop();};audio.onerror=failed;
    message('正在载入作者访谈…','Loading the interview…');
    audio.play().catch(failed);
  }
  function readButtons(parent,getText){
    parent.append(button('朗读','Listen',()=>speak(getText(),1)),button('慢读','Slow',()=>speak(getText(),0.75)));
  }
  termActions.append(label(make('small'),'合成示范','Synthesized voice'));
  readButtons(termActions,()=>tidy(field.value));readButtons(exampleActions,()=>expectedSentence);
  function render(){
    const value=tidy(field.value);
    const isAbaucin=/^abaucin[.,;:]?$/i.test(value);
    viva.hidden=!isAbaucin;if(!isAbaucin)viva.open=false;
    termActions.hidden=!english(value);sources.replaceChildren();follow.replaceChildren();
    if(isAbaucin){
      const play=button('听作者念 abaucin','Hear the author say abaucin',()=>authorAudio(1));
      play.className='ep-primary';sources.append(play,button('原声慢放','Slow original',()=>authorAudio(0.76)),link('播客 · 40:03','Podcast · 40:03','https://www.buzzsprout.com/2599310/episodes/19632903?t=2403'),link('访谈文字稿','ACS transcript',acs+'#:~:text=we%20named%20Abaucin'));
      follow.append(link('发现这款药的原始研究','Original discovery paper',discovery));
    }else if(/^[a-z][a-z '\-]{0,65}$/i.test(value) && value.split(/\s+/).length<=5){
      sources.append(link('在词典查发音','Look up pronunciation', 'https://www.merriam-webster.com/dictionary/'+encodeURIComponent(value)));
      if(!context.onAsk)follow.append(link('查相关研究','Find related research','https://search.crossref.org/?q='+encodeURIComponent(value)));
    }
    const original=tidy(context.sentence);
    const useOriginal=english(original) && original!==value && (!isAbaucin || /abaucin/i.test(original));
    expectedSentence=useOriginal ? original : isAbaucin ? 'Abaucin showed narrow-spectrum activity against Acinetobacter baumannii.' : '';
    label(sentenceLabel,useOriginal ? (context.caption?'英文图注':'当前英文讲解') : '汇报例句',useOriginal ? (context.caption?'English caption':'In context') : 'For your talk');
    sentence.textContent=expectedSentence;example.hidden=!expectedSentence;
    if(context.onAsk && value){
      const ask=button('查背景与练答辩','Explore background & rehearse',()=>{
        const prompt='In English, explain “'+value.slice(0,180)+'” in the context of this figure. Give the research background with a source, one sentence I can use in my talk, and one likely audience question with a brief answer.';
        box.close();context.onAsk([value,expectedSentence].filter(Boolean).join('\n'),prompt);
      }); follow.append(ask);
    }
    follow.hidden=!follow.children.length;
  }
  function pickWord(){
    const sel=window.getSelection();
    if(!sel || sel.isCollapsed || !sentence.contains(sel.anchorNode) || !sentence.contains(sel.focusNode))return;
    const term=tidy(sel.toString());
    if(term && term.length<100 && english(term)){field.value=term;stop();render();}
  }
  sentence.addEventListener('pointerup',pickWord);
  sentence.addEventListener('keyup',pickWord);
  function open(options={}){
    stop();viva.open=false;context=options;origin=options.origin || document.activeElement;
    field.value=english(options.text)?tidy(options.text).slice(0,900):'';
    scope.textContent=options.scope||'';scope.hidden=!scope.textContent;
    render();
    if(!box.open)box.showModal();
    if(field.value)(sources.querySelector('button') || termActions.firstElementChild).focus();else field.focus();
  }
  field.addEventListener('input',()=>{stop();render();});
  box.addEventListener('close',()=>{if(!box.open){stop();if(origin?.isConnected)origin.focus({preventScroll:true});}});
  box.addEventListener('click',e=>{if(e.target!==box)return;const r=box.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)box.close();});
  window.addEventListener('pagehide',()=>{if(box.open)box.close();stop();});
  window.EnglishPractice={open,sentenceOf,selectionSentence,close:()=>{if(box.open)box.close();}};
  if(new URLSearchParams(location.search).get('practice')==='abaucin')open({text:'abaucin'});
})();
