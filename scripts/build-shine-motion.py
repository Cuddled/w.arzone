from pathlib import Path
import json,zipfile,hashlib,base64
root=Path(__file__).resolve().parent.parent
folder=root/'plugins/shine-motion'
m=json.loads((folder/'manifest.json').read_text())
art={name:'data:image/jpeg;base64,'+base64.b64encode((root/'assets/shine-motion'/f'{name}.jpg').read_bytes()).decode() for name in ['mercury','prism','afterimage','jellyfish']}
script=(folder/'js/index.js').read_text().replace('__SHINE_ART__',json.dumps(art,separators=(',',':')))
build=root/'build/shine-motion'; build.mkdir(exist_ok=True)
(build/'index.js').write_text(script)
filename=m['id']+'@'+m['version']+'.zip'; target=root/'pool'/filename
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for name,content in [('manifest.json',json.dumps(m,indent=2)),('index.js',script)]:
        info=zipfile.ZipInfo(name,date_time=(2026,10,8,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,content)
blob=target.read_bytes(); ip=root/'index.json';index=json.loads(ip.read_text())
index['plugins'][m['id']]={**{k:m[k] for k in ['name','description','author','icon']},'channels':{'latest':m['version']},'versions':{m['version']:{'url':'https://raw.githubusercontent.com/Cuddled/w.arzone/main/pool/'+filename,'sha256':hashlib.sha256(blob).hexdigest(),'size':len(blob),'dependencies':m['dependencies']}}}
ip.write_text(json.dumps(index,indent=2)+'\n');print(filename,len(blob),hashlib.sha256(blob).hexdigest())
