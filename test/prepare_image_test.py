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
