/* Reader-owned credentials live only in this document. Both editions share the provider and prompt definitions. */
(() => {
  'use strict';
  const keys = new Map();
  const names = ['deepseek', 'qwen'];
  let contractRequest;

  function options() {
    return {automatic: names.find(name => keys.has(name)) || 'evidence',
      available: {evidence: true, deepseek: keys.has('deepseek'), qwen: keys.has('qwen')}};
  }

  function setKey(provider, key) {
    if (!window.isSecureContext) throw Error('请通过 HTTPS 打开阅读器');
    if (!names.includes(provider) || typeof key !== 'string' || (key && !/^[!-~]{1,512}$/.test(key))) {
      throw Error('请检查 API 密钥格式');
    }
    if (key) keys.set(provider, key);
    else keys.delete(provider);
    return options();
  }

  function contract() {
    if (!contractRequest) {
      contractRequest = fetch('./reading-models.json?rev=0415', {credentials:'omit', redirect:'error'})
        .then(response => {
          if (!response.ok) throw Error();
          return response.json();
        }).catch(() => {
          contractRequest = undefined;
          throw Error('未能读取模型设置，请刷新后重试');
        });
    }
    return contractRequest;
  }

  async function complete(provider, task, message, signal) {
    if (!keys.has(provider)) throw Error('阅读器尚未配置此服务的 API 密钥');
    const config = await contract();
    const token = keys.get(provider);
    if (!token) throw Error('阅读器尚未配置此服务的 API 密钥');
    const {endpoint, model} = config.providers[provider];
    const {system, schema} = config[task];
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, {once:true});
    const timeout = setTimeout(abort, 90000);
    try {
      const body = {model, stream:false, response_format:{type:'json_object'}, messages:[
        {role:'system', content:system+' Return a JSON object matching this schema: '+JSON.stringify(schema)},
        {role:'user', content:JSON.stringify(message)}
      ]};
      if (provider === 'qwen') body.enable_thinking = false;
      const response = await fetch(endpoint, {
        method:'POST', credentials:'omit', mode:'cors', redirect:'error', cache:'no-store', referrerPolicy:'no-referrer',
        headers:{'Authorization':'Bearer '+token, 'Content-Type':'application/json'},
        body:JSON.stringify(body), signal:controller.signal
      });
      if (!response.ok) {
        const errors = {401:'服务密钥未通过验证',402:'模型账户余额不足',403:'当前凭据无权使用此模型',429:'服务繁忙或额度已用完'};
        throw Error(errors[response.status] || '模型服务返回错误');
      }
      const data = await response.json();
      const choice = data?.choices?.[0];
      if (choice?.finish_reason === 'length') throw Error('模型回答被截断，请缩短问题后重试');
      const text = choice?.message?.content;
      if (typeof text !== 'string') throw Error('模型返回的结构不完整');
      return JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/gi,''));
    } catch (error) {
      if (signal?.aborted) throw error;
      if (controller.signal.aborted) throw Error('模型请求超时，请稍后重试');
      if (error instanceof TypeError) throw Error('暂时未能连接模型服务');
      if (error instanceof SyntaxError) throw Error('模型返回的结构不完整');
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }

  async function answer(provider, body, evidence, signal) {
    if (body.sharePublic !== true) throw Error('请先确认要发送的文字');
    if (!keys.has(provider)) throw Error('阅读器尚未配置此服务的 API 密钥');
    const config = await contract();
    const paper = (body.paper || []).slice(0,7).map((p,i) => ({id:'P'+(i+1),kind:p.kind,page:p.page,text:p.text}));
    const reading = {paper, excerpt:body.excerpt, question:body.question, location:body.location, previous:body.history || []};
    const obj = await complete(provider, 'question', {task:config.question.task, reading,
      externalRecords:evidence.literature, searchStatus:evidence.search.status}, signal);
    const ids = new Set([...paper, ...evidence.literature].map(r => r.id));
    const result = {...evidence, provider};
    for (const name of config.question.schema.required) {
      const line = obj?.[name];
      if (typeof line?.zh !== 'string' || typeof line?.en !== 'string' || !Array.isArray(line.refs)) {
        throw Error('模型返回的回答不完整');
      }
      result[name] = {zh:line.zh.slice(0,4500), en:line.en.slice(0,4500), refs:line.refs.filter(ref => ids.has(ref))};
    }
    if (!result.reported.zh.trim() && !result.background.zh.trim()) throw Error('模型未返回解释');
    if (paper.length && !config.question.schema.required.some(k => result[k].refs.some(ref => ref.startsWith('P')))) {
      throw Error('模型未标出可核对的本文出处');
    }
    return result;
  }

  async function outline({provider, language, excerpt}, signal) {
    const result = await complete(provider, 'outline', {language, paper:excerpt}, signal);
    if (typeof result?.outline !== 'string' || !result.outline.trim() || result.outline.length > 120000) {
      throw Error('未收到完整大纲');
    }
    return {outline:result.outline};
  }

  window.addEventListener('pagehide', () => keys.clear());
  window.ReaderBrowserModels = {options, setKey, answer, outline};
})();
