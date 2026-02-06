#!/usr/bin/env python
# -*- coding: utf-8 -*-
import json
import os
import sys

base_path = r'f:\40_Docs\resume-system\interview\questions'

categories = {
    'cpp': list(range(1, 16)),
    'qt': list(range(1, 11)),
    'network': list(range(1, 11)),
    'design_pattern': list(range(1, 6)),
    'project': list(range(1, 9)),
    'behavior': list(range(1, 11))
}

output_lines = []

for category, ids in categories.items():
    for qid in ids:
        if category == 'cpp':
            id_str = f'cpp_{qid:03d}'
        elif category == 'qt':
            id_str = f'qt_{qid:03d}'
        elif category == 'network':
            id_str = f'net_{qid:03d}'
        elif category == 'design_pattern':
            id_str = f'dp_{qid:03d}'
        elif category == 'project':
            id_str = f'proj_{qid:03d}'
        elif category == 'behavior':
            id_str = f'beh_{qid:03d}'
        
        file_path = os.path.join(base_path, category, id_str, 'question.json')
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8-sig') as f:
                    data = json.load(f)
            except:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            question_text = data.get('question', '')
            tags = data.get('tags', [])
            difficulty = data.get('difficulty', '')
            tags_json = json.dumps(tags, ensure_ascii=False)
            line = f'{category}|{id_str}|{question_text}|{tags_json}|{difficulty}'
            output_lines.append(line)

# Write to file with UTF-8 encoding
with open('questions_output.txt', 'w', encoding='utf-8') as f:
    for line in output_lines:
        f.write(line + '\n')

# Also print to console
for line in output_lines:
    print(line)
