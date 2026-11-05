"""Prepare pinned Linux/amd64 image contents. No Cloudflare credentials needed."""
import concurrent.futures,hashlib,io,json,os,pathlib,shutil,subprocess,tarfile,urllib.request,zipfile
ROOT=pathlib.Path(__file__).resolve().parent.parent
lock=json.loads((ROOT/'tools.lock.json').read_text())
image=ROOT/'.cache/image-root'
def download(pin):
 with urllib.request.urlopen(pin['url'],timeout=90) as response:body=response.read(100_000_001)
 if len(body)>100_000_000 or hashlib.sha256(body).hexdigest()!=pin['assetSha256']:raise RuntimeError('Archive checksum mismatch: '+pin['tool'])
 with zipfile.ZipFile(io.BytesIO(body)) as archive:
  binary=archive.read(pin['tool'])
  if hashlib.sha256(binary).hexdigest()!=pin['binarySha256']:raise RuntimeError('Binary checksum mismatch: '+pin['tool'])
  destination=image/'opt/pentcloud-recon/bin'/pin['tool'];destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(binary);destination.chmod(0o755)
  licenses=[n for n in archive.namelist() if pathlib.PurePosixPath(n).name.lower().startswith('license') and not n.endswith('/')]
  if not licenses:raise RuntimeError('Missing upstream license: '+pin['tool'])
  for name in licenses:
   out=image/'usr/share/licenses/pentcloud-recon'/pin['tool']/pathlib.PurePosixPath(name).name;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(archive.read(name))
 return pin['tool']
def fresh_stage(cache):
 image=cache/'image-root'
 if cache.is_symlink() or image.is_symlink():raise ValueError('Image staging must not be a symlink')
 if image.exists():shutil.rmtree(image)
 image.mkdir(parents=True)
 return image

def main():
 global image
 image=fresh_stage(ROOT/'.cache')
 version=subprocess.check_output(['go','env','GOVERSION'],text=True).strip()
 if version!='go1.26.5':raise RuntimeError('Build with the pinned Go 1.26.5 toolchain')
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:print('Verified upstream archives and binaries: '+', '.join(pool.map(download,lock['tools'])),flush=True)
 environment={**os.environ,'GOOS':'linux','GOARCH':'amd64','CGO_ENABLED':'0'}
 helper=image/'opt/pentcloud-recon/bin/recon-exec'
 subprocess.run(['go','build','-buildvcs=false','-trimpath','-ldflags=-buildid=','-o',str(helper),'./runner'],cwd=ROOT,env=environment,check=True)
 manifest={**lock,'helperSha256':hashlib.sha256(helper.read_bytes()).hexdigest()}
 (image/'opt/pentcloud-recon/pack.json').write_text(json.dumps(manifest,indent=2)+'\n')
 for name in ['LICENSE','THIRD_PARTY_NOTICES.md']:
  out=image/'usr/share/licenses/pentcloud-recon'/name;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes((ROOT/name).read_bytes())
 with tarfile.open(ROOT/'.cache/recon-layer.tar','w',format=tarfile.USTAR_FORMAT) as archive:
  for path in sorted(image.rglob('*')):
   info=archive.gettarinfo(str(path),str(path.relative_to(image)));info.uid=info.gid=0;info.uname=info.gname='root';info.mtime=0;info.mode=0o755 if path.is_dir() or path.parent.name=='bin' else 0o644
   if path.is_file():
    with path.open('rb') as source:archive.addfile(info,source)
   else:archive.addfile(info)
 print('Prepared image contents and deterministic layer in .cache',flush=True)

if __name__=='__main__':main()
