"""Fixed destinations for optional hosted and local text models."""
import json
import os
import re
import threading
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

HOSTED = {
    'deepseek': ('https://api.deepseek.com/chat/completions', 'DEEPSEEK_API_KEY', 'READING_DEEPSEEK_MODEL', 'deepseek-flash'),
    'qwen': ('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', 'DASHSCOPE_API_KEY', 'READING_QWEN_MODEL', 'qwen-plus')
}
LOCAL = 'http://127.0.0.1:11434/api/'
MODES = ('auto', 'evidence', 'deepseek', 'qwen', 'ollama', 'chatgpt')


_session_keys = {}
_key_lock = threading.Lock()


def set_session_key(provider, key):
    if provider not in HOSTED or not isinstance(key, str) or len(key) > 512 or (key and not re.fullmatch(r'[!-~]+', key)):
        raise ValueError('Invalid session key')
    with _key_lock:
        if key:
            _session_keys[provider] = key
        else:
            _session_keys.pop(provider, None)


def credential(provider):
    with _key_lock:
        return _session_keys.get(provider) or os.environ.get(HOSTED[provider][1])


class ProviderIssue(Exception):
    pass


class FixedDestination(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request_json(url, body=None, token=None, timeout=75):
    headers = {'Accept':'application/json','Content-Type':'application/json'}
    if token:
        headers['Authorization']='Bearer '+token
    local=url.startswith(LOCAL)
    opener=build_opener(ProxyHandler({}), FixedDestination()) if local else build_opener(FixedDestination())
    req=Request(url, data=json.dumps(body).encode('utf-8') if body is not None else None, headers=headers)
    try:
        with opener.open(req, timeout=timeout) as response:
            return json.loads(response.read(2_000_000))
    except HTTPError as exc:
        msg={401:'服务密钥未通过验证',403:'当前凭据无权使用此模型',429:'服务繁忙或额度已用完'}.get(exc.code,'模型服务返回错误')
        raise ProviderIssue(msg) from None
    except (ValueError,OSError,URLError):
        raise ProviderIssue('暂时未能连接模型服务') from None


def local_model():
    name=os.environ.get('READING_OLLAMA_MODEL')
    if name:return name
    try:
        models=request_json(LOCAL+'tags',timeout=1).get('models') or []
        return next((m['name'] for m in models if m.get('name') and 'embed' not in m['name'].lower()),'')
    except (ProviderIssue, KeyError, TypeError):
        return ''


def automatic(cli):
    for key in HOSTED:
        if credential(key):return key
    if local_model():return 'ollama'
    return 'chatgpt' if cli else 'evidence'


def decode(text):
    if not isinstance(text,str):raise ProviderIssue('模型没有返回可读回答')
    content=re.sub(r'^\s*```(?:json)?\s*|\s*```\s*$','',text.strip(),flags=re.I)
    try:return json.loads(content)
    except ValueError:raise ProviderIssue('模型返回的结构不完整') from None


def complete(provider,system,message,schema):
    messages=[{'role':'system','content':system+' Return a JSON object matching this schema: '+json.dumps(schema)},
              {'role':'user','content':json.dumps(message,ensure_ascii=False)}]
    if provider=='ollama':
        model=local_model()
        if not model:raise ProviderIssue('本机尚未提供 Ollama 对话模型')
        data=request_json(LOCAL+'chat',{'model':model,'messages':messages,'stream':False,'format':schema})
        return decode((data.get('message') or {}).get('content'))
    endpoint,secret,model_env,default=HOSTED[provider]
    token=credential(provider)
    if not token:raise ProviderIssue('阅读器尚未配置此服务的 API 密钥')
    body={'model':os.environ.get(model_env) or default,'messages':messages,'response_format':{'type':'json_object'},'stream':False}
    data=request_json(endpoint,body,token)
    choices=data.get('choices') or []
    return decode((choices[0].get('message') or {}).get('content') if choices else None)