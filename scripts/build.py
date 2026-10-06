"""Package a self-contained Revenge Next plugin and static repository index."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import zipfile

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--base-url', required=True, help='Public directory URL, without index.json')
args = parser.parse_args()
if not re.match(r'^https?://', args.base_url):
    raise SystemExit('Base URL must be an absolute HTTP(S) URL')
manifest = json.loads((root/'plugins/marble-glass/manifest.json').read_text())
texture = (root/'assets/marble.jpg').read_bytes()
uri = 'data:image/jpeg;base64,' + base64.b64encode(texture).decode()
source = (root/'plugins/marble-glass/js/index.js').read_text()
assert source.count('__MARBLE_URI__') == 1
bundle = source.replace('__MARBLE_URI__', uri)
(root/'build').mkdir(exist_ok=True)
(root/'build/index.js').write_text(bundle)
filename = manifest['id'] + '@' + manifest['version'] + '.zip'
target = root/'pool'/filename
target.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, content in [('manifest.json', json.dumps(manifest, indent=2)), ('index.js', bundle)]:
        info = zipfile.ZipInfo(name, date_time=(2026,10,6,0,0,0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, content)
blob = target.read_bytes()
config = {
    'format': 1,
    'name': 'Cuddled · Marble Glass',
    'description': 'White marble and translucent glass for Revenge Next.',
    'plugins': {manifest['id']: {
        'name': manifest['name'], 'description': manifest['description'],
        'author': manifest['author'], 'icon': manifest['icon'],
        'channels': {'latest': manifest['version']},
        'versions': {manifest['version']: {
            'url': args.base_url.rstrip('/') + '/pool/' + filename,
            'sha256': hashlib.sha256(blob).hexdigest(), 'size': len(blob),
            'dependencies': manifest['dependencies']
        }}
    }}
}
(root/'index.json').write_text(json.dumps(config, indent=2)+'\n')
print(f'Built {filename}: {len(blob):,} bytes, SHA-256 {hashlib.sha256(blob).hexdigest()}')
