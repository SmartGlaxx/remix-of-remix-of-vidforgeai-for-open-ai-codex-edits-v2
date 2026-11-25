"""Exercise the production extraction functions without starting a RunPod worker."""
import ast
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from types import SimpleNamespace

source = Path(__file__).with_name("handler.py").read_text()
tree = ast.parse(source)
selected = ast.Module(body=[node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in {"extract_last_frame", "capscify_extract_frame"}], type_ignores=[])

class FrameTests(unittest.TestCase):
    def test_extracts_actual_last_frame_not_the_frame_point_four_seconds_earlier(self):
        with tempfile.TemporaryDirectory() as directory:
            clip = Path(directory) / "source.mp4"
            subprocess.run(["ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=red:s=64x64:r=24:d=1", "-f", "lavfi", "-i", "color=c=blue:s=64x64:r=24:d=0.2", "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]", "-c:v", "libx264", str(clip)], check=True, capture_output=True)
            fake_response = SimpleNamespace(content=clip.read_bytes(), raise_for_status=lambda: None)
            namespace = {"os": os, "requests": SimpleNamespace(get=lambda *args, **kwargs: fake_response), "tempfile": tempfile}
            exec(compile(selected, "handler.py", "exec"), namespace)
            frame = namespace["extract_last_frame"]("https://saved.test/clip.mp4", directory)
            pixel = subprocess.run(["ffmpeg", "-i", frame, "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], check=True, capture_output=True).stdout
            self.assertGreater(pixel[2], 200)
            self.assertLess(pixel[0], 40)

    def test_route_returns_the_extracted_frame_url(self):
        calls = []
        namespace = {"tempfile": tempfile, "extract_last_frame": lambda url, folder: calls.append(url) or "final.jpg", "upload_file_to_filebase": lambda path, prefix: "https://ipfs.filebase.io/ipfs/final"}
        # Only the route is loaded here, keeping the mock extractor intact.
        route = ast.Module(body=[n for n in selected.body if n.name == "capscify_extract_frame"], type_ignores=[])
        exec(compile(route, "handler.py", "exec"), namespace)
        result = namespace["capscify_extract_frame"]({"video_url": "https://example.supabase.co/storage/v1/object/public/videos/saved.mp4"})
        self.assertEqual(calls, ["https://example.supabase.co/storage/v1/object/public/videos/saved.mp4"])
        self.assertEqual(result, {"last_frame_url": "https://ipfs.filebase.io/ipfs/final"})

if __name__ == "__main__":
    unittest.main()