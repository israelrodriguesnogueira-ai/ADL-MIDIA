"""Testes sem API paga para o gerador de vídeo ION."""
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "ion-video-gratuito.py"
spec = importlib.util.spec_from_file_location("ion_video", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class VideoTests(unittest.TestCase):
    def test_four_scenes(self):
        self.assertEqual(len(module.SCENES), 4)
    def test_duration(self):
        self.assertEqual(module.DURATION, 15)
    def test_content(self):
        for heading, caption in module.SCENES:
            self.assertTrue(heading.strip())
            self.assertTrue(caption.strip())
    def test_interface_exists(self):
        ui = (ROOT / "ion-central-comandos.html").read_text(encoding="utf-8")
        self.assertIn("SpeechRecognition", ui)
        self.assertIn("ion-video-gratuito.yml", ui)
        self.assertIn("não dispara o workflow automaticamente", ui)

if __name__ == "__main__":
    unittest.main()
