import importlib.util,pathlib,unittest,io,tarfile,tempfile
spec=importlib.util.spec_from_file_location('pack',pathlib.Path(__file__).resolve().parents[1]/'scripts/prepare-pack.py');pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack)
class DebTests(unittest.TestCase):
 def archive(self,name,body=b'payload',link=None):
  out=io.BytesIO()
  with tarfile.open(fileobj=out,mode='w:xz') as t:
   m=tarfile.TarInfo(name)
   if link:m.type=tarfile.SYMTYPE;m.linkname=link
   else:m.size=len(body);m.mode=0o755
   t.addfile(m,None if link else io.BytesIO(body))
  return out.getvalue()
 def test_package_paths_cannot_escape_staging(self):
  with tempfile.TemporaryDirectory() as d:
   with self.assertRaises(ValueError):pack.extract_payload(self.archive('../escape'),pathlib.Path(d),[])
 def test_links_are_deferred_until_regular_files_are_written(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);links=[]
   pack.extract_payload(self.archive('usr/bin/tool',link='/usr/bin/original'),root,links)
   self.assertFalse((root/'usr/bin/tool').exists());self.assertEqual(len(links),1)
   pack.extract_payload(self.archive('usr/bin/original'),root,links)
   self.assertEqual((root/'usr/bin/original').read_bytes(),b'payload')
 def test_deferred_links_cannot_modify_a_sibling_through_a_symlink_parent(self):
  with tempfile.TemporaryDirectory() as d:
   parent=pathlib.Path(d);root=parent/'stage';root.mkdir();outside=parent/'outside';outside.mkdir();victim=outside/'victim';victim.write_bytes(b'keep')
   links=[(root/'escape','../outside',False),(root/'escape/victim','replacement',False)]
   with self.assertRaises(ValueError):pack.install_links(root,links)
   self.assertEqual(victim.read_bytes(),b'keep');self.assertFalse(victim.is_symlink())
