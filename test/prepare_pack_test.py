import importlib.util, pathlib, tempfile, unittest, io, tarfile, hashlib
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('pack',pathlib.Path(__file__).resolve().parents[1]/'scripts/prepare-pack.py')
pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack)
class PackPreparationTests(unittest.TestCase):
 def test_corrupt_download_cannot_enter_staging(self):
  with tempfile.TemporaryDirectory() as directory, patch.object(pack.urllib.request,'urlopen',return_value=io.BytesIO(b'corrupt')):
   with self.assertRaisesRegex(RuntimeError,'Checksum'):pack.verified({'url':'https://download.invalid/archive','sha256':hashlib.sha256(b'valid').hexdigest()},pathlib.Path(directory))
 def test_source_archive_cannot_write_outside_its_root(self):
  body=io.BytesIO()
  with tarfile.open(fileobj=body,mode='w:gz') as archive:
   m=tarfile.TarInfo('sqlmap-1.10/../../escaped');m.size=4;archive.addfile(m,io.BytesIO(b'oops'))
  with tempfile.TemporaryDirectory() as directory:
   root=pathlib.Path(directory)
   with self.assertRaises(ValueError):pack.install_source(body.getvalue(),root/'source')
   self.assertFalse((root/'escaped').exists())
 def test_source_archive_keeps_payload_and_upstream_license(self):
  body=io.BytesIO()
  with tarfile.open(fileobj=body,mode='w:gz') as archive:
   for name,data in [('sqlmap.py',b'print("upstream")'),('LICENSE',b'upstream license')]:
    m=tarfile.TarInfo('sqlmap-1.10/'+name);m.size=len(data);archive.addfile(m,io.BytesIO(data))
  with tempfile.TemporaryDirectory() as directory:
   root=pathlib.Path(directory);pack.install_source(body.getvalue(),root)
   self.assertEqual((root/'LICENSE').read_bytes(),b'upstream license');self.assertEqual((root/'sqlmap.py').read_bytes(),b'print("upstream")')
