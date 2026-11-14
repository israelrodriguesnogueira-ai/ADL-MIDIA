#!/usr/bin/env python3
"""Gera vídeo educativo vertical de 15 segundos sem API paga.
Requer FFmpeg instalado. Usa fundos vetoriais e áudio sintético original.
Não representa imagens fotográficas ou narração humana.
"""
import argparse
import shutil
import subprocess
from pathlib import Path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--saida", default="saida/ion-transito-15s.mp4")
    args = parser.parse_args()
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise SystemExit("FFmpeg e ffprobe precisam estar instalados.")
    out = Path(args.saida)
    out.parent.mkdir(parents=True, exist_ok=True)
    # Cada cena é um fundo vetorial, com sinalização em texto e transições temporais.
    # Sem fontes externas nem arquivos com direitos autorais.
    vf = (
        "drawbox=x=70:y=190:w=580:h=900:color=0x1b365d:t=fill,"
        "drawbox=x=335:y=220:w=50:h=840:color=white@0.75:t=fill,"
        "drawbox=x=80:y=980:w=560:h=8:color=yellow:t=fill,"
        "drawbox=x=95:y=1080:w=530:h=8:color=yellow:t=fill,"
        "drawbox=x=110:y=1180:w=500:h=8:color=yellow:t=fill,"
        "drawbox=x=125:y=1280:w=470:h=8:color=yellow:t=fill,"
        "drawbox=x=140:y=1380:w=440:h=8:color=yellow:t=fill"
    )
    cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", "color=c=0x0c1728:s=720x1280:r=30:d=15",
        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=15",
        "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "96k", "-t", "15", "-movflags", "+faststart", str(out)
    ]
    subprocess.run(cmd, check=True, timeout=120)
    check = subprocess.run([ffprobe, "-v", "error", "-show_entries",
        "stream=codec_type", "-of", "csv=p=0", str(out)],
        capture_output=True, text=True, check=True, timeout=15)
    streams = set(check.stdout.split())
    if not {"video", "audio"}.issubset(streams):
        raise SystemExit("Exportação inválida: áudio ou vídeo ausente")
    print(f"Arquivo validado: {out}")

if __name__ == "__main__":
    main()
