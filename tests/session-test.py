"""Check session credentials without contacting a model provider."""
import os
import sys
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import reading_providers as providers
import reading_questions as questions

with patch.dict(os.environ, {}, clear=True), patch.object(providers, 'local_model', return_value=''), patch('shutil.which', return_value=None):
    try:
        assert questions.options()['automatic'] == 'evidence'
        providers.set_session_key('qwen', 'fixture-session-key')
        assert questions.options()['automatic'] == 'qwen'
        assert 'fixture-session-key' not in str(questions.options())
        with patch.object(providers,'request_json',return_value={'choices':[{'message':{'content':'{}'}}]}) as call:
            providers.complete('qwen','system',{}, {})
            assert call.call_args.args[2] == 'fixture-session-key'
        providers.set_session_key('qwen','')
        assert questions.options()['automatic'] == 'evidence'
        with patch.dict(os.environ,{'DEEPSEEK_API_KEY':'env-test'}):
            providers.set_session_key('deepseek','ui-test')
            assert providers.credential('deepseek') == 'ui-test'
            providers.set_session_key('deepseek','')
            assert providers.credential('deepseek') == 'env-test'
        for name,value in [('other','key'),('deepseek','header\nvalue')]:
            try:providers.set_session_key(name,value)
            except ValueError:pass
            else:raise AssertionError('Invalid setting accepted')
    finally:
        for name in providers.HOSTED:providers.set_session_key(name, '')
print('PASS session keys, provider selection, request credentials and removal.')
