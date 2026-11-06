import importlib.util,pathlib,tempfile,unittest
spec=importlib.util.spec_from_file_location('prepare',pathlib.Path(__file__).resolve().parents[1]/'scripts/prepare-image.py')
prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)
class StagingTests(unittest.TestCase):
 def test_stale_files_do_not_enter_new_images(self):
  with tempfile.TemporaryDirectory() as directory:
   cache=pathlib.Path(directory)/'cache';image=cache/'image-root';image.mkdir(parents=True);(image/'unrelated').write_text('must not ship')
   self.assertEqual(list(prepare.fresh_stage(cache).iterdir()),[])
 def test_symlinked_staging_is_rejected(self):
  with tempfile.TemporaryDirectory() as directory:
   root=pathlib.Path(directory);outside=root/'outside';outside.mkdir();(outside/'preserve').write_text('keep');cache=root/'cache';cache.mkdir();(cache/'image-root').symlink_to(outside,target_is_directory=True)
   with self.assertRaises(ValueError):prepare.fresh_stage(cache)
   self.assertTrue((outside/'preserve').exists())
 def test_symlinked_cache_is_rejected(self):
  with tempfile.TemporaryDirectory() as directory:
   root=pathlib.Path(directory);outside=root/'outside';outside.mkdir();cache=root/'cache';cache.symlink_to(outside,target_is_directory=True)
   with self.assertRaises(ValueError):prepare.fresh_stage(cache)

import hashlib,io,zipfile
from unittest.mock import patch

class DownloadTests(unittest.TestCase):
 def archive(self,with_license=True):
  data=io.BytesIO()
  with zipfile.ZipFile(data,'w') as z:
   z.writestr('httpx',b'fixture executable')
   if with_license:z.writestr('../../LICENSE.md',b'fixture upstream license')
  return data.getvalue()
 def pin(self,archive):
  return {'tool':'httpx','url':'https://download.invalid/httpx.zip','assetSha256':hashlib.sha256(archive).hexdigest(),'binarySha256':hashlib.sha256(b'fixture executable').hexdigest()}
 def test_verified_download_preserves_binary_and_confines_license_path(self):
  data=self.archive()
  with tempfile.TemporaryDirectory() as directory,patch.object(prepare,'image',pathlib.Path(directory)/'image'),patch.object(prepare.urllib.request,'urlopen',return_value=io.BytesIO(data)):
   self.assertEqual(prepare.download(self.pin(data)),'httpx')
   binary=prepare.image/'opt/pentcloud-recon/bin/httpx'
   self.assertEqual(binary.read_bytes(),b'fixture executable');self.assertEqual(binary.stat().st_mode&0o777,0o755)
   self.assertEqual((prepare.image/'usr/share/licenses/pentcloud-recon/httpx/LICENSE.md').read_bytes(),b'fixture upstream license')
   self.assertFalse((pathlib.Path(directory)/'LICENSE.md').exists())
 def test_archive_checksum_mismatch_prevents_installation(self):
  data=self.archive();pin=self.pin(data);pin['assetSha256']='0'*64
  with tempfile.TemporaryDirectory() as directory,patch.object(prepare,'image',pathlib.Path(directory)/'image'),patch.object(prepare.urllib.request,'urlopen',return_value=io.BytesIO(data)):
   with self.assertRaisesRegex(RuntimeError,'Archive checksum mismatch'):prepare.download(pin)
   self.assertFalse(prepare.image.exists())
 def test_binary_checksum_mismatch_prevents_installation(self):
  data=self.archive();pin=self.pin(data);pin['binarySha256']='0'*64
  with tempfile.TemporaryDirectory() as directory,patch.object(prepare,'image',pathlib.Path(directory)/'image'),patch.object(prepare.urllib.request,'urlopen',return_value=io.BytesIO(data)):
   with self.assertRaisesRegex(RuntimeError,'Binary checksum mismatch'):prepare.download(pin)
   self.assertFalse(prepare.image.exists())
 def test_missing_upstream_license_aborts_preparation(self):
  data=self.archive(with_license=False)
  with tempfile.TemporaryDirectory() as directory,patch.object(prepare,'image',pathlib.Path(directory)/'image'),patch.object(prepare.urllib.request,'urlopen',return_value=io.BytesIO(data)):
   with self.assertRaisesRegex(RuntimeError,'Missing upstream license'):prepare.download(self.pin(data))
