(() => {
  'use strict';
  const fields=[['x','横轴名称','X label'],['xUnit','横轴单位','X unit'],['y','纵轴名称','Y label'],['yUnit','纵轴单位','Y unit']];
  const ui=(tag,zh,en)=>PaperUI.set(document.createElement(tag),zh,en);
  function editor(chart,values,onSave){
    const details=document.createElement('details');details.className='hist-axes';
    details.append(ui('summary','核对并校正坐标轴','Review and edit axes'));
    const inferred=['x','y'].map(k=>chart[k]||chart.shared?.find(s=>s.kind===k)?.label||'—');
    details.append(ui('p','识别原字　X · '+inferred[0]+'　 Y · '+inferred[1],'Detected labels'));
    const form=document.createElement('form'),inputs={};
    for(const [key,zh,en] of fields){
      const label=ui('label',zh,en),input=document.createElement('input');
      input.type='text';input.maxLength=120;input.value=values?.[key]||'';
      input.placeholder=key==='x'?inferred[0]:key==='y'?inferred[1]:'';
      input.name=key;label.append(input);form.append(label);inputs[key]=input;
    }
    const save=ui('button','保存本图校正','Save for this plot');save.type='submit';
    const restore=ui('button','恢复自动识别','Use detected labels');restore.type='button';restore.disabled=!values;
    const actions=document.createElement('div');actions.append(save,restore);form.append(actions);
    form.onsubmit=e=>{e.preventDefault();const next={};
      for(const [key] of fields){const s=inputs[key].value.trim();if(s)next[key]=s}
      onSave(Object.keys(next).length?next:null)};
    restore.onclick=()=>onSave(null);
    details.append(form);return details;
  }
  function apply(reading,chart,values){
    if(!values)return;
    for(const [axis,zh,en] of [['x','横轴','Horizontal axis'],['y','纵轴','Vertical axis']]){
      const name=values[axis],unit=values[axis+'Unit'];
      if(!name&&!unit)continue;
      const row=reading.rows.find(r=>r.zh.startsWith(zh));
      if(!row)continue;
      if(name){
        row.zh=zh+' · 读者核对';row.en=en+' · reader verified';
        row.content={zh:'读者按原图录入「'+name+'」。',en:'Reader transcription: “'+name+'”.'};
      }
      if(unit){
        row.content={zh:row.content.zh+' 读者核对的单位为 '+unit+'。',en:row.content.en+' Reader-verified unit: '+unit+'.'};
      }
    }
  }
  window.HistogramAxes={editor,apply};
})();
