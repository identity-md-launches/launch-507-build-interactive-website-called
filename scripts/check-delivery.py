"""Check relative export assets and inventory the deliverable without reading Git metadata."""
from pathlib import Path
import hashlib
import json
import re

root = Path('.')
export = root / 'dist'
files = []
for item in sorted(export.rglob('*')):
    if item.is_file():
        files.append({'path': str(item), 'bytes': item.stat().st_size,
                      'sha256': hashlib.sha256(item.read_bytes()).hexdigest()})
references = re.findall(r'(?:src|href)="(.*?)"', (export / 'index.html').read_text())
assets = [ref for ref in references if not ref.startswith('#')]
for ref in assets:
    assert ref.startswith('./'), f'Non-relative asset: {ref}'
    target = export / ref
    assert target.is_file() or (target.is_dir() and (target / 'index.html').is_file()), f'Missing local target: {ref}'
assert len(list((export / 'assets').glob('*.js'))) == 1
assert len(list((export / 'assets').glob('*.css'))) == 1
assert not any(p.suffix in {'.map', '.tgz', '.zip'} for p in export.rglob('*'))
manifest = {'relative_urls': assets, 'total_bytes': sum(f['bytes'] for f in files), 'files': files}
(root / 'artifacts/export-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

excluded = {'.git', '.imd', '.agents', '.codex'}
report_path = root / 'artifacts/delivery-inventory.json'
deliverables = []

def visit(directory):
    for item in sorted(directory.iterdir()):
        relative = item.relative_to(root)
        if relative.parts[0] in excluded or relative.parts[:2] == ('test', 'scratch'):
            continue
        assert not item.is_symlink(), f'Unexpected symlink: {item}'
        assert item.name not in {'node_modules', '.cache', '.npm', '__pycache__'}, f'Generated dependency/cache: {item}'
        assert item.name != '.gitmodules', 'Submodules are not allowed'
        if item.is_dir():
            visit(item)
        elif item != report_path:
            assert item.suffix not in {'.tgz', '.zip'}, f'Unneeded packaging archive: {item}'
            deliverables.append({'path': str(relative), 'bytes': item.stat().st_size})

visit(root)
size = sum(item['bytes'] for item in deliverables)
report = {'budget_bytes': 8388608, 'payload_bytes_excluding_this_report': size,
          'export_bytes': manifest['total_bytes'], 'file_count_excluding_this_report': len(deliverables),
          'note': 'Conservative raw-file payload measure; no Git metadata was read or mutated. Task inputs and disposable scratch are excluded.',
          'files': deliverables}
report_path.write_text(json.dumps(report, indent=2) + '\n')
total = size + report_path.stat().st_size
assert total < report['budget_bytes'], f'Delivery exceeds budget: {total}'
print(f'PASS: {len(deliverables) + 1} delivered files, {total:,} raw bytes including inventory; export {manifest["total_bytes"]:,} bytes; budget 8,388,608 bytes.')
