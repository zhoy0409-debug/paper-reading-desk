// Only repair a uniquely identifiable rendering of a predicate stated in the
// source. A genuinely missing predicate needs review, not an invented clause.
const association = /\b(negative(?:ly)?|inverse(?:ly)?|positive(?:ly)?)\s+(?:associat(?:ed|ions?)|correlat(?:ed|ions?)|relat(?:ed|ionships?))\b/gi;
const proportional = /\bproportion(?:al(?:ity|ly)?)?\b/i;
const proxy = /\b(?:as (?:an? |the )?(?:indirect |useful |possible )?prox(?:y|ies) for|proxy (?:measure|indicator)s? of)\b/i;
const health = /\b(?:risks?|patients?|disease|cohort|clinical|diagnos\w*|cardiovascular|diabetes|morbidity|incidence|stroke|cancers?)\b/i;
const knownOutcomes = /^(?:CVD|CHD|HF|CAD|CKD|T2D|T2DM|AF|MI|COPD)$/;
const temporal = /\b(?:calendar|fiscal|seasonal|quarterly|quarters? of (?:the |a )?year|year[- ]on[- ]year|months?)\b/i;
const quantile = /\bquartiles?\b/i;
const quarters = /\b(?:ascending|increasing|decreasing|lowest|highest|upper|lower|successive) quarters?\b/i;
const compareGroups = /\b(?:hazard|odds|risk|categories|category|distribution|participants?|quantiles?)\b/i;

function singleMatch(text, pattern) {
  const hits = [...text.matchAll(pattern)];
  return hits.length === 1 ? hits[0] : null;
}

function substitutions(source, target, field) {
  const list = [];
  function replace(sourcePhrase, pattern, replacement) {
    const hit = singleMatch(target, pattern);
    if (hit) list.push({source:sourcePhrase,target:hit[0],index:hit.index,replacement});
  }
  const relation = singleMatch(source, association);
  if (relation && !proportional.test(source)) {
    const positive = relation[1].toLowerCase().startsWith('positive');
    replace(relation[0], positive ? /(?:成|呈)正比(?:例关系|关系)?/g : /(?:成|呈)反比(?:例关系|关系)?/g, positive ? '呈正相关' : '呈负相关');
  }
  const proxyMatch = source.match(proxy);
  if (proxyMatch && !/\b(?:synonyms?|linguistic|denote|stand[s]? for)\b/i.test(source))
    replace(proxyMatch[0], /代名词/g, '替代指标');
  const q = compareGroups.test(source) && (source.match(quantile) || source.match(quarters));
  if (q && !temporal.test(source)) {
    if (/\b(?:increasing|ascending) quarters?\b/i.test(source) && /增加(?:的)?季度/.test(target))
      replace(q[0], /增加(?:的)?季度/g, '由低到高的四分位组');
    else replace(q[0], /季度/g, '四分位组');
  }
  const outcome = singleMatch(source, /\b[Ii]ncident\s+([A-Z][A-Z\d-]{1,12})\b/g);
  const clinical = ['medicine','clinical','epidemiology','pharmacology'].includes(field?.id || field);
  if (outcome && (knownOutcomes.test(outcome[1]) || (clinical && health.test(source)))
      && !/\b(?:radiation|wavelength|beam|photon|fluence|irradiance|light|laser|angle of incidence)\b/i.test(source)) {
    const id = outcome[1];
    const hit = singleMatch(target, new RegExp('(?:事件|事故)(?:的)?\\s*'+id+'(?![A-Za-z\\d-])','g'));
    if (hit) list.push({source:outcome[0],target:hit[0],index:hit.index,replacement:'新发 '+id});
  }
  return list;
}

export function recoverClaimWording(source, target, field) {
  let text = target;
  for (const item of substitutions(source,target,field).sort((a,b)=>b.index-a.index))
    text = text.slice(0,item.index) + item.replacement + text.slice(item.index+item.target.length);
  return text;
}

export function claimIssues(source,target,field) {
  const issues = substitutions(source,target,field).map(item=>({
    code:'relation',severity:'severe',sourceEvidence:item.source,targetEvidence:item.target
  }));
  const fewer = source.match(/\bfewer\s+(?!than\b)[a-z]+(?:-[a-z]+)*/i);
  if (fewer && !/\b(?:no|not)\s+fewer\b/i.test(source)
      && !/(?:更少|较少|少于|少了|减少|更低|较低|低于|偏少|少量|数(?:量|目)[^。；]{0,6}少)/.test(target))
    issues.push({code:'direction',severity:'severe',sourceEvidence:fewer[0].trim()});
  const independent = source.match(/\b(?:independent(?:ly)? of|irrespective of|regardless of)\b/i);
  if (independent && !/(?:独立|无关|不(?:受|依赖|取决于|论|管|影响|随)|无论|关乎与否)/.test(target))
    issues.push({code:'relation',severity:'severe',sourceEvidence:independent[0]});
  const cadence=source.match(/\b(?:hourly|daily|weekly|monthly|yearly|annual(?:ly)?)\b/i);
  const mean=target.match(/(?:小时|时|日|周|月|年)(?:平均|均)(?=[\u3400-\u9fff\d])/);
  if(cadence&&mean&&!/\b(?:mean|averag\w*)\b/i.test(source))
    issues.push({code:'relation',severity:'severe',sourceEvidence:cadence[0],targetEvidence:mean[0]});
  const risk=source.match(/\b(?:with|associated with|linked to) (?:an? )?(?:lower|higher|increased|reduced) risk\b/i);
  const intervention=target.match(/(?:会|可(?:以|能)?|能够|从而|有助于)(?:有效|显著)?(?:降低|提高|增加|减少)[^。；，]{0,24}(?:风险|危险性)/);
  if(risk&&intervention&&!/\b(?:caus\w*|prevent\w*|reduc(?:es?|ing)|increas(?:es?|ing)|leads? to|results? in)\b/i.test(source))
    issues.push({code:'causality',severity:'severe',sourceEvidence:risk[0],targetEvidence:intervention[0]});
  const sequence=source.match(/^(?:following|after) (?:each|every|the last|the final) (?:[a-z-]+ ){0,2}(?:trial|condition|scan|test|visit|session)\b/i);
  if(sequence&&!/(?:后|结束|完成|之后|随后)/.test(target))
    issues.push({code:'sequence',severity:'severe',sourceEvidence:sequence[0]});
  const wholeRecording=source.match(/\b(?:each|every|per)\s+(?:video|recording|image)\b(?![- ](?:frame|pixel))/i);
  const subdivision=target.match(/(?:每(?:一)?帧(?:视频|录像|影像)|每(?:一)?(?:个)?像素)/);
  if(wholeRecording&&subdivision&&!/\b(?:frames?|pixels?)\b/i.test(source))
    issues.push({code:'relation',severity:'severe',sourceEvidence:wholeRecording[0],targetEvidence:subdivision[0]});
  const conjecture=source.match(/\b(?:would|might|could) have (?:been|reached|occurred|resulted|arisen)\b/i);
  const certainty=target.match(/已(?:经)?(?:达到|产生|发生|出现|完成|证实|确定)|确实(?:是|达到|发生)/);
  if(conjecture&&certainty&&!/本应|原应|推测|推断|可能|或许|应(?:当|该|已|为|处于)|本可|本会|本来会/.test(target))
    issues.push({code:'modality',severity:'severe',sourceEvidence:conjecture[0],targetEvidence:certainty[0]});
  return issues;
}
