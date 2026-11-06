"""Prepare checksum-pinned pack layers; no downloads happen at runtime."""
import hashlib, io, json, os, pathlib, shutil, subprocess, sys, tarfile, urllib.request, zipfile
ROOT=pathlib.Path(__file__).resolve().parent.parent
def verified(pin,cache):
 cache.mkdir(parents=True,exist_ok=True)
 file=cache/pin['sha256']
 if file.is_symlink():raise ValueError('Download cache must not contain symlinks')
 if file.exists():body=file.read_bytes()
 else:
  with urllib.request.urlopen(pin['url'],timeout=90) as response:body=response.read(100_000_001)
 if len(body)>100_000_000 or hashlib.sha256(body).hexdigest()!=pin['sha256']:raise RuntimeError('Checksum mismatch: '+pin['url'])
 file.write_bytes(body)
 return body
def install_source(body,destination):
 with tarfile.open(fileobj=io.BytesIO(body),mode='r:gz') as archive:
  total=0
  for member in archive:
   parts=pathlib.PurePosixPath(member.name).parts
   if not parts or member.name.startswith('/') or '..' in parts or member.issym() or member.islnk():raise ValueError('Unsafe source archive path')
   if len(parts)<2 or member.isdir():continue
   if not member.isfile():raise ValueError('Unsupported source archive member')
   total+=member.size
   if total>100_000_000:raise ValueError('Source archive exceeds bounds')
   path=destination.joinpath(*parts[1:]);path.parent.mkdir(parents=True,exist_ok=True)
   path.write_bytes(archive.extractfile(member).read())
def put(root,path,body,mode=0o644):
 out=root/path;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(body);out.chmod(mode)
def prepare(name):
 if name not in ['http','nuclei','sqlmap']:raise ValueError('Select http, nuclei or sqlmap')
 lock=json.loads((ROOT/'packages'/name/'tools.lock.json').read_text())
 cache=ROOT/'.cache';stage=cache/'packs'/name/'root';home='opt/pentcloud-'+name
 if cache.is_symlink() or (cache/'packs').is_symlink() or stage.parent.is_symlink() or stage.is_symlink():raise ValueError('Staging must not use symlinks')
 if stage.exists():shutil.rmtree(stage)
 stage.mkdir(parents=True)
 for pin in lock['tools']:
  if 'url' not in pin:continue
  body=verified(pin,cache/'pack-downloads')
  if pin['format']=='sqlmap-tar':
   install_source(body,stage/home/'assets/sqlmap')
   if not (stage/home/'assets/sqlmap/LICENSE').is_file():raise RuntimeError('Missing SQLmap license')
   continue
  if pin['format']=='zip':
   archive=zipfile.ZipFile(io.BytesIO(body));binary=archive.read(pin['member']);licenses=[(pathlib.PurePosixPath(p).name,archive.read(p)) for p in archive.namelist() if pathlib.PurePosixPath(p).name.lower().startswith('license') and not p.endswith('/')]
  else:
   with tarfile.open(fileobj=io.BytesIO(body),mode='r:gz') as archive:
    binary=archive.extractfile(pin['member']).read();licenses=[(pathlib.PurePosixPath(m.name).name,archive.extractfile(m).read()) for m in archive if m.isfile() and pathlib.PurePosixPath(m.name).name.lower().startswith('license')]
  if hashlib.sha256(binary).hexdigest()!=pin['binarySha256']:raise RuntimeError('Binary checksum mismatch')
  if not licenses:raise RuntimeError('Missing upstream license')
  put(stage,home+'/bin/'+pin['tool'],binary,0o755)
  for filename,content in licenses:put(stage,'usr/share/licenses/pentcloud-'+name+'/'+pin['tool']+'/'+filename,content)
 for pin in lock['assets']:
  body=(ROOT/pin['local']).read_bytes() if 'local' in pin else verified(pin,cache/'pack-downloads')
  if hashlib.sha256(body).hexdigest()!=pin['sha256']:raise RuntimeError('Asset checksum mismatch')
  if pin.get('format')=='apk-openssl':
   with tarfile.open(fileobj=io.BytesIO(body),mode='r:gz',ignore_zeros=True) as archive:
    put(stage,home+'/bin/openssl',archive.extractfile('usr/bin/openssl').read(),0o755)
  else:put(stage,home+'/assets/'+pin['path'],body)
 if name=='http':(stage/home/'bin/curl').symlink_to('/usr/bin/curl')
 if name=='sqlmap':(stage/home/'bin').mkdir(parents=True,exist_ok=True);(stage/home/'bin/sqlmap').symlink_to('/usr/local/bin/python3')
 version=subprocess.check_output(['go','env','GOVERSION'],text=True).strip()
 if version!='go1.26.5':raise RuntimeError('Use Go 1.26.5')
 helper=stage/home/'bin/pack-exec'
 flags='-buildid= -X main.binDirectory=/'+home+'/bin -X main.executableNames='+','.join(lock['executables'])+' -X main.runtimeHome=/tmp/pentcloud-'+name
 subprocess.run(['go','build','-buildvcs=false','-trimpath','-ldflags='+flags,'-o',str(helper),'./runner'],cwd=ROOT,env={**os.environ,'GOOS':'linux','GOARCH':'amd64','CGO_ENABLED':'0'},check=True)
 digest=hashlib.sha256(json.dumps(lock,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
 put(stage,home+'/pack.json',(json.dumps({'lockSha256':digest,'lock':lock,'helperSha256':hashlib.sha256(helper.read_bytes()).hexdigest()},indent=2)+'\n').encode())
 for notice in ['LICENSE','THIRD_PARTY_NOTICES.md']:put(stage,'usr/share/licenses/pentcloud-'+name+'/'+notice,(ROOT/'packages'/name/notice).read_bytes())
 layer=stage.parent/'layer.tar'
 with tarfile.open(layer,'w',format=tarfile.USTAR_FORMAT) as archive:
  for path in sorted(stage.rglob('*')):
   info=archive.gettarinfo(str(path),str(path.relative_to(stage)));info.uid=info.gid=0;info.uname=info.gname='root';info.mtime=0
   info.mode=0o755 if path.is_dir() or path.parent.name=='bin' else 0o644
   if path.is_file() and not path.is_symlink():
    with path.open('rb') as source:archive.addfile(info,source)
   else:archive.addfile(info)
 print('Prepared '+name+' '+lock['packVersion'])
if __name__=='__main__':prepare(sys.argv[1] if len(sys.argv)>1 else '')
