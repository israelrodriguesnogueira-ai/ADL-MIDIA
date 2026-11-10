#!/usr/bin/env python3
"""Valida o registro operacional, sem rede e sem alterar arquivos."""
import json
from pathlib import Path

p = Path(__file__).with_name('estado.json')
data = json.loads(p.read_text(encoding='utf-8'))
assert data['schema_version'] == 1
for name in ('video_shopee', 'memoria_operacional', 'continuidade_ativa'):
    item = data['projects'][name]
    assert isinstance(item['status'], str) and item['status']
    assert isinstance(item['next_action'], str) and item['next_action']
video = data['projects']['video_shopee']
assert video['duration_seconds'] == 15 and video['format'] == '9:16'
assert isinstance(video['render_running'], bool)
if video['render_running']:
    assert video.get('job_id'), 'Render em andamento exige job_id verificavel'
print('ADL: estado operacional valido')
for name, item in data['projects'].items():
    print(f"- {name}: {item['status']} | proximo: {item['next_action']}")
