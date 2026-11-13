#!/usr/bin/env python3
"""Finalize a 15-second vertical clip with supplied narration and subtitles."""

import argparse
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def finalize(video, narration, subtitles, output):
    if output.suffix.lower() != ".mp4":
        raise ValueError("A saída deve ter extensão .mp4.")
    if output.exists() and any(output.samefile(item) for item in (video, narration, subtitles)):
        raise ValueError("A saída deve ser um arquivo diferente dos insumos.")
    output.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix=".aion-video-", dir=output.parent) as folder:
        work = Path(folder)
        shutil.copyfile(subtitles, work / "legendas.srt")
        candidate = work / "video.mp4"
        subprocess.run([
            "ffmpeg", "-nostdin", "-v", "error", "-xerror",
            "-i", str(video), "-i", str(narration),
            "-map", "0:V:0", "-map", "1:a:0",
            "-vf", ("scale=trunc(iw*sar/2)*2:ih,setsar=1,"
                    "scale=720:1280:force_original_aspect_ratio=decrease:"
                    "force_divisible_by=2,setsar=1,"
                    "pad=720:1280:(ow-iw)/2:(oh-ih)/2,"
                    "subtitles=legendas.srt"),
            "-af", "apad", "-t", "15", "-shortest",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-movflags", "+faststart", str(candidate),
        ], cwd=work, check=True, timeout=180)
        duration = subprocess.check_output([
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=duration", "-of", "csv=p=0", str(candidate),
        ], text=True, timeout=15).strip()
        if not 14.95 <= float(duration) <= 15.05:
            raise ValueError(f"O vídeo exportado tem {duration} s. Esperado: 15 s.")
        subprocess.run([
            sys.executable, str(Path(__file__).with_name("validar-exportacao.py")),
            str(candidate), "--exigir-audio",
        ], check=True, timeout=125)
        candidate.replace(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("narracao", type=Path)
    parser.add_argument("legendas", type=Path)
    parser.add_argument("saida", type=Path)
    args = parser.parse_args()
    try:
        finalize(args.video.resolve(strict=True), args.narracao.resolve(strict=True),
                 args.legendas.resolve(strict=True), args.saida.resolve())
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        parser.exit(1, f"Falha na finalização: {error}\n")


if __name__ == "__main__":
    main()
