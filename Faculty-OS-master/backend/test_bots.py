import requests
import json
import time

base_url = 'http://127.0.0.1:8000'
agents = ['agent7', 'agent8', 'agent9', 'agent10']
messages = ['Hello', 'How can I add a new record?', 'Show me the summary']

print('--- TESTING 4 AGENTS ---')
for agent in agents:
    print(f'\n================= {agent.upper()} =================')
    for msg in messages:
        print(f'\n> User: {msg}')
        try:
            response = requests.post(
                f'{base_url}/agents/{agent}/chat',
                json={'message': msg, 'history': [], 'faculty_id': 1},
                stream=True
            )
            
            if response.status_code != 200:
                print(f'Error: HTTP {response.status_code}')
                continue
                
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    if decoded_line.startswith('data: '):
                        data_str = decoded_line[6:].strip()
                        if data_str:
                            try:
                                data = json.loads(data_str)
                                if data['type'] == 'trace':
                                    print(f'  [Tool: {data["name"]}]')
                                elif data['type'] == 'content':
                                    print(data['delta'], end='', flush=True)
                                elif data['type'] == 'error':
                                    print(f'\n  [ERROR: {data["detail"]}]')
                            except json.JSONDecodeError:
                                pass
            print() # new line after response finishes
        except Exception as e:
            print(f'Exception: {e}')
