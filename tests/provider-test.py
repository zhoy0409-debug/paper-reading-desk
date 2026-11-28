"""Provider wire format, evidence fallback and origin checks require no credentials."""
from unittest.mock import patch
import json
import os
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
import reading_providers as providers
import reading_questions as reader
reply={k:{'zh':'读图','en':'Read','refs':['P1']} for k in reader.KEYS}
raw={'sharePublic':True,'question':'This comparison?','excerpt':'The comparison','location':'Fig. A','history':[],'searchPublic':False,'paper':[{'kind':'整图图注','text':'Study groups compared','page':2}]}
for name,env in [('deepseek','DEEPSEEK_API_KEY'),('qwen','DASHSCOPE_API_KEY'),('ollama','READING_OLLAMA_MODEL')]:
    wire={'message':{'content':json.dumps(reply)}} if name=='ollama' else {'choices':[{'message':{'content':json.dumps(reply)}}]}
    with patch.dict(os.environ,{env:'unit-test-placeholder'},clear=True),patch.object(providers,'request_json',return_value=wire) as call:
        result=reader.answer(reader.payload(dict(raw,provider=name)))
        assert result['provider']==name,result
        url,body,*auth=call.call_args.args
        assert url==(providers.LOCAL+'chat' if name=='ollama' else providers.HOSTED[name][0])
        assert body['messages'][1]['role']=='user'
        assert result['reported']['refs']==['P1'] and result['search']['status']=='off'
    with patch.dict(os.environ,{env:'unit-test-placeholder'},clear=True),patch.object(providers,'request_json',side_effect=providers.ProviderIssue('额度已用完')):
        result=reader.answer(reader.payload(dict(raw,provider=name)))
        assert result['provider']=='evidence' and result['modelNotice']=='额度已用完'
print('PASS DeepSeek, Qwen and Ollama request/response formats and quota fallback')

message = {'target': 'zh', 'field': 'physics', 'context': '', 'terms': [],
           'units': [{'id': '1-0', 'text': 'Light passed through the glass.'}]}
translated = {'translations': [{'id': '1-0', 'text': '光穿过玻璃。'}]}
for name, env in [('deepseek', 'DEEPSEEK_API_KEY'), ('qwen', 'DASHSCOPE_API_KEY'), ('ollama', 'READING_OLLAMA_MODEL')]:
    body = {'provider': name, 'message': message, 'consent': True}
    wire = {'message': {'content': json.dumps(translated)}} if name == 'ollama' else {
        'choices': [{'message': {'content': json.dumps(translated)}}]}
    with patch.dict(os.environ, {env: 'test-placeholder'}, clear=True), patch.object(providers, 'request_json', return_value=wire) as call:
        assert reader.translate_selection(reader.translation_payload(body)) == translated
        url, request, *_ = call.call_args.args
        assert url == (providers.LOCAL + 'chat' if name == 'ollama' else providers.HOSTED[name][0])
        assert json.loads(request['messages'][1]['content']) == message
    for invalid in (dict(body, consent=False), dict(body, paper='private'),
                    dict(body, message=dict(message, context='x' * 8001)),
                    dict(body, message=dict(message, units=message['units'] * 2))):
        try:
            reader.translation_payload(invalid)
        except ValueError:
            continue
        raise AssertionError('Accepted an invalid precision request')
print('PASS three precision adapters send only the previewed payload and reject missing consent, extra data and duplicate IDs')
