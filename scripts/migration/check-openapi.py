#!/usr/bin/env python3
"""Verifica referências e cobertura das rotas Laravel pelo contrato OpenAPI local."""
import json
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
contract = json.loads((root / 'docs/api/openapi.json').read_text())
errors = []


def visit(value):
    if isinstance(value, dict):
        if '$ref' in value:
            current = contract
            try:
                for key in value['$ref'].removeprefix('#/').split('/'):
                    current = current[key.replace('~1', '/').replace('~0', '~')]
            except (KeyError, TypeError):
                errors.append('Referência ausente: ' + value['$ref'])
        for child in value.values():
            visit(child)
    elif isinstance(value, list):
        for child in value:
            visit(child)


visit(contract)
documented = set()
operation_ids = set()
for path, methods in contract['paths'].items():
    for method, operation in methods.items():
        if method not in ['get', 'post', 'patch', 'delete', 'put']:
            continue
        operation_id = operation['operationId']
        if operation_id in operation_ids:
            errors.append('operationId duplicado: ' + operation_id)
        operation_ids.add(operation_id)
        params = {p['name'] for p in operation.get('parameters', []) if p['in'] == 'path'}
        if set(re.findall(r'\{([^}]+)\}', path)) != params:
            errors.append('Parâmetros de path divergentes: ' + path)
        if path != '/sanctum/csrf-cookie':
            documented.add((method.upper(), path))

result = subprocess.run(['php', 'artisan', 'route:list', '--json', '--except-vendor'], cwd=root / 'apps/api', capture_output=True, text=True)
if result.returncode:
    print(result.stderr or result.stdout)
    sys.exit(result.returncode)
implemented = set()
for route in json.loads(result.stdout):
    if not route['uri'].startswith('api/v1/'):
        continue
    path = '/' + route['uri'].removeprefix('api/v1/')
    paths = [path.replace('{resource}', name) for name in ['services', 'professionals', 'customers']] if '{resource}' in path else [path]
    implemented.update((method, p) for p in paths for method in route['method'].split('|') if method != 'HEAD')
for method, path in sorted(implemented - documented):
    errors.append('Rota sem contrato: ' + method + ' ' + path)
for method, path in sorted(documented - implemented):
    errors.append('Contrato sem rota: ' + method + ' ' + path)
if errors:
    print('\n'.join(errors))
    sys.exit(1)
print(f'OpenAPI: referências, operationIds, parâmetros e cobertura de {len(implemented)} operações aprovados.')
