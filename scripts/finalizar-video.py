#!/usr/bin/env python3
"""Finalize a vertical clip with supplied narration and subtitles."""

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def finalize(video, narration, subtitles, output, seconds=15):
    if not 1 <= seconds <= 60:
        raise ValueError("A duração deve estar entre 1 e 60 segundos.")
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
            "-af", "apad", "-t", str(seconds), "-shortest",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-movflags", "+faststart", str(candidate),
        ], cwd=work, check=True, timeout=180)
        metadata = json.loads(subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries",
            "stream=codec_type,duration", "-of", "json", str(candidate),
        ], text=True, timeout=15))
        durations = {stream["codec_type"]: stream.get("duration")
                     for stream in metadata["streams"]}
        for kind in ("video", "audio"):
            duration = durations.get(kind)
            if duration is None or abs(float(duration) - seconds) > 0.05:
                raise ValueError(f"Faixa {kind}: {duration} s. Esperado: {seconds} s.")
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
    parser.add_argument("--duracao", type=int, default=15, help="Duração em segundos (1 a 60).")
    args = parser.parse_args()
    try:
        finalize(args.video.resolve(strict=True), args.narracao.resolve(strict=True),
                 args.legendas.resolve(strict=True), args.saida.resolve(), args.duracao)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        parser.exit(1, f"Falha na finalização: {error}\n")


if __name__ == "__main__":
    main()
