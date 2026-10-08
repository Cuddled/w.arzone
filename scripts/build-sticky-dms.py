"""Package Sticky DMs while preserving the other plugins in the repository."""
from pathlib import Path
import json, zipfile, hashlib
root = Path(__file__).resolve().parent.parent
folder = root / 'plugins/sticky-dms'
manifest = json.loads((folder / 'manifest.json').read_text())
# Next accepts numeric version components with a single optional label, not SemVer prerelease chains.
import re
if not re.fullmatch(r'\d+\.\d+\.\d+', manifest['version']):
    raise SystemExit('Use a plain three-part numeric version for this plugin')
filename = manifest['id'] + '@' + manifest['version'] + '.zip'
target = root / 'pool' / filename
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, content in [('manifest.json', json.dumps(manifest, indent=2)), ('index.js', (folder/'js/index.js').read_text())]:
        info = zipfile.ZipInfo(name, date_time=(2026,10,8,0,0,0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, content)
blob = target.read_bytes()
index_path = root / 'index.json'
index = json.loads(index_path.read_text())
entry = index['plugins'].setdefault(manifest['id'], {'versions': {}})
entry.update({key: manifest[key] for key in ['name', 'description', 'author', 'icon']})
entry['channels'] = {'latest': manifest['version']}
entry['versions'][manifest['version']] = {
    'url': 'https://raw.githubusercontent.com/Cuddled/w.arzone/main/pool/' + filename,
    'sha256': hashlib.sha256(blob).hexdigest(), 'size': len(blob), 'dependencies': manifest['dependencies']
}
index_path.write_text(json.dumps(index, indent=2) + '\n')
print(f'Built {filename}: {len(blob)} bytes; SHA-256 {hashlib.sha256(blob).hexdigest()}')
