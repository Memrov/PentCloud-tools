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
def install_source(body,destination,staging_root=None):
 if staging_root is None:destination.mkdir(parents=True,exist_ok=True)
 root=staging_root or destination
 with tarfile.open(fileobj=io.BytesIO(body),mode='r:gz') as archive:
  total=0
  for member in archive:
   parts=pathlib.PurePosixPath(member.name).parts
   if not parts or member.name.startswith('/') or '..' in parts or member.issym() or member.islnk():raise ValueError('Unsafe source archive path')
   if len(parts)<2 or member.isdir():continue
   if not member.isfile():raise ValueError('Unsupported source archive member')
   total+=member.size
   if total>100_000_000:raise ValueError('Source archive exceeds bounds')
   path=destination.joinpath(*parts[1:])
   put(root,str(path.relative_to(root)),archive.extractfile(member).read(),0o755 if member.mode&0o111 else 0o644)
def safe_parent(root,path):
 relative=path.relative_to(root)
 if '..' in relative.parts:raise ValueError('Unsafe destination path')
 parent=root
 for part in relative.parts[:-1]:
  parent=parent/part
  if parent.is_symlink():raise ValueError('Staging parent must not be a symlink')
  if parent.exists() and not parent.is_dir():raise ValueError('Staging parent is not a directory')
  parent.mkdir(exist_ok=True)
def put(root,path,body,mode=0o644):
 out=root/path;safe_parent(root,out)
 if out.is_symlink():raise ValueError('Staging file must not be a symlink')
 out.write_bytes(body);out.chmod(mode)
def extract_payload(body,root,links):
 with tarfile.open(fileobj=io.BytesIO(body),mode='r:*') as archive:
  total=0
  for member in archive:
   parts=pathlib.PurePosixPath(member.name).parts
   if member.name.startswith('/') or '..' in parts:raise ValueError('Unsafe package path')
   if not parts:continue
   path=root.joinpath(*parts)
   if member.isdir():safe_parent(root,path/'child');continue
   if member.issym() or member.islnk():links.append((path,member.linkname,member.islnk()));continue
   if not member.isfile():raise ValueError('Unsupported package member')
   total+=member.size
   if total>1000000000:raise ValueError('Package expands beyond limit')
   put(root,str(path.relative_to(root)),archive.extractfile(member).read(),0o755 if member.mode&0o111 else 0o644)
def install_deb(body,root,links):
 if not body.startswith(b'!<arch>\n'):raise ValueError('Invalid Debian archive')
 offset=8
 while offset+60<=len(body):
  header=body[offset:offset+60];size=int(header[48:58]);name=header[:16].decode().strip().rstrip('/');offset+=60
  if name.startswith('data.tar'):
   extract_payload(body[offset:offset+size],root,links);return
  offset+=size+(size%2)
 raise ValueError('Debian payload missing')
def install_links(root,links):
 for path,target,hard in sorted(links,key=lambda x:not x[2]):
  safe_parent(root,path)
  if path.exists() or path.is_symlink():path.unlink()
  if hard:
   parts=pathlib.PurePosixPath(target).parts
   if target.startswith('/') or '..' in parts:raise ValueError('Unsafe package hard link')
   origin=root.joinpath(*parts);safe_parent(root,origin)
   if origin.is_symlink() or not origin.is_file():raise ValueError('Invalid package hard link')
   os.link(origin,path)
  else:path.symlink_to(target)
def prepare(name):
 if name not in ['http','nuclei','sqlmap','service','web-context','pcap','file-analysis','password','reference','metasploit']:raise ValueError('Unsupported pack')
 lock=json.loads((ROOT/'packages'/name/'tools.lock.json').read_text())
 cache=ROOT/'.cache';stage=cache/'packs'/name/'root';home='opt/pentcloud-'+name
 if cache.is_symlink() or (cache/'packs').is_symlink() or stage.parent.is_symlink() or stage.is_symlink():raise ValueError('Staging must not use symlinks')
 if stage.exists():shutil.rmtree(stage)
 stage.mkdir(parents=True)
 links=[]
 for pin in lock.get('debs',[]):install_deb(verified(pin,cache/'pack-downloads'),stage,links)
 install_links(stage,links)
 for relative,target in lock.get('filesystemLinks',{}).items():
  path=stage/relative;safe_parent(stage,path)
  if path.exists() or path.is_symlink():path.unlink()
  path.symlink_to(target)
 for pin in lock['tools']:
  if 'url' not in pin:continue
  body=verified(pin,cache/'pack-downloads')
  if pin['format'] in ['sqlmap-tar','source-tar']:
   destination=stage/home/'assets'/pin.get('destination','sqlmap');install_source(body,destination,stage)
   if pin['format']=='sqlmap-tar' and not (destination/'LICENSE').is_file():raise RuntimeError('Missing SQLmap license')
   continue
  if pin['format']=='7z-source':
   archive=cache/'pack-downloads'/pin['sha256'];destination=stage/home/'assets'/pin['destination'];safe_parent(stage,destination/'child')
   names=subprocess.check_output(['tar','-tf',str(archive)],text=True).splitlines()
   if any(n.startswith('/') or '..' in pathlib.PurePosixPath(n).parts for n in names):raise ValueError('Unsafe 7z archive')
   subprocess.run(['tar','-xf',str(archive),'-C',str(destination),'--strip-components','1','--no-same-owner','--no-same-permissions'],check=True)
   (destination/pin['member']).chmod(0o755)
   continue
  if pin['format']=='zip':
   archive=zipfile.ZipFile(io.BytesIO(body));binary=archive.read(pin['member']);licenses=[(pathlib.PurePosixPath(p).name,archive.read(p)) for p in archive.namelist() if pathlib.PurePosixPath(p).name.lower().startswith('license') and not p.endswith('/')]
  else:
   with tarfile.open(fileobj=io.BytesIO(body),mode='r:gz') as archive:
    binary=archive.extractfile(pin['member']).read();licenses=[(pathlib.PurePosixPath(m.name).name,archive.extractfile(m).read()) for m in archive if m.isfile() and pathlib.PurePosixPath(m.name).name.lower().startswith('license')]
  if hashlib.sha256(binary).hexdigest()!=pin['binarySha256']:raise RuntimeError('Binary checksum mismatch')
  if not licenses and not pin.get('licenseAsset') and not (pin.get('licenseMissing') and lock.get('privateOnlyReasons')):raise RuntimeError('Missing upstream license')
  put(stage,home+'/bin/'+pin['tool'],binary,0o755)
  for filename,content in licenses:put(stage,'usr/share/licenses/pentcloud-'+name+'/'+pin['tool']+'/'+filename,content)
 for pin in lock['assets']:
  body=(ROOT/pin['local']).read_bytes() if 'local' in pin else verified(pin,cache/'pack-downloads')
  if hashlib.sha256(body).hexdigest()!=pin['sha256']:raise RuntimeError('Asset checksum mismatch')
  if pin.get('format')=='apk-openssl':
   with tarfile.open(fileobj=io.BytesIO(body),mode='r:gz',ignore_zeros=True) as archive:
    put(stage,home+'/bin/openssl',archive.extractfile('usr/bin/openssl').read(),0o755)
  else:put(stage,home+'/assets/'+pin['path'],body,0o755 if pin.get('executable') else 0o644)
 if name=='http':(stage/home/'bin/curl').symlink_to('/usr/bin/curl')
 if name=='sqlmap':(stage/home/'bin').mkdir(parents=True,exist_ok=True);(stage/home/'bin/sqlmap').symlink_to('/usr/local/bin/python3')
 for executable,target in lock.get('links',{}).items():
  path=stage/home/'bin'/executable;safe_parent(stage,path);path.symlink_to(target)
 if lock.get('referenceFiles'):
  for filename,relative in lock['referenceFiles'].items():put(stage,'opt/exploitdb/'+filename,(stage/home/'assets'/relative).read_bytes(),0o755 if filename=='searchsploit' else 0o644)
 # Package post-install scripts are not run on the build host. Generate the
 # standard trust bundle deterministically from the pinned certificate package.
 certs=sorted((stage/'usr/share/ca-certificates').rglob('*.crt'))
 if certs:
  put(stage,'etc/ssl/certs/ca-certificates.crt',b'\n'.join(p.read_bytes() for p in certs))
  certlink=stage/'usr/lib/ssl/cert.pem';safe_parent(stage,certlink)
  if not certlink.is_symlink() and not certlink.exists():certlink.symlink_to('/etc/ssl/certs/ca-certificates.crt')
 version=subprocess.check_output(['go','env','GOVERSION'],text=True).strip()
 if version!='go1.26.5':raise RuntimeError('Use Go 1.26.5')
 helper=stage/home/'bin/pack-exec'
 flags='-buildid= -X main.binDirectory=/'+home+'/bin -X main.executableNames='+','.join(lock['executables'])+' -X main.runtimeHome=/tmp/pentcloud-'+name
 if lock.get('files'):flags+=' -X main.allowFiles=true'
 subprocess.run(['go','build','-buildvcs=false','-trimpath','-ldflags='+flags,'-o',str(helper),'./runner'],cwd=ROOT,env={**os.environ,'GOOS':'linux','GOARCH':'amd64','CGO_ENABLED':'0'},check=True)
 digest=hashlib.sha256(json.dumps(lock,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
 put(stage,home+'/pack.json',(json.dumps({'lockSha256':digest,'lock':lock,'helperSha256':hashlib.sha256(helper.read_bytes()).hexdigest()},indent=2)+'\n').encode())
 for notice in ['LICENSE','THIRD_PARTY_NOTICES.md']:put(stage,'usr/share/licenses/pentcloud-'+name+'/'+notice,(ROOT/'packages'/name/notice).read_bytes())
 layer=stage.parent/'layer.tar'
 with tarfile.open(layer,'w',format=tarfile.PAX_FORMAT) as archive:
  for path in sorted(stage.rglob('*')):
   info=archive.gettarinfo(str(path),str(path.relative_to(stage)));info.uid=info.gid=0;info.uname=info.gname='root';info.mtime=0
   info.pax_headers={};info.mode=0o755 if path.is_dir() or path.parent.name=='bin' or (not path.is_symlink() and path.stat().st_mode&0o111) else 0o644
   if path.is_file() and not path.is_symlink():
    with path.open('rb') as source:archive.addfile(info,source)
   else:archive.addfile(info)
 print('Prepared '+name+' '+lock['packVersion'])
if __name__=='__main__':prepare(sys.argv[1] if len(sys.argv)>1 else '')
