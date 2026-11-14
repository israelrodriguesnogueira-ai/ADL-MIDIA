#!/usr/bin/env python3
"""Protótipo 0800: vídeo educativo 9:16, cenas, legendas e voz sintetizada.
Dependências: ffmpeg, ffprobe, espeak-ng, fontes DejaVu. Sem API externa.
"""
import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

SCENES = [
    ("ATENCAO NO TRANSITO", "Celular e volante nao combinam."),
    ("RESPEITE O SINAL", "Respeite o sinal de transito."),
    ("MANTENHA DISTANCIA", "Mantenha distancia segura."),
    ("SEGURANCA SALVA VIDAS", "Atitudes seguras salvam vidas."),
]
DURATION = 15
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def run(cmd, timeout=150):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=timeout)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--saida", default="saida/ion-transito-15s.mp4")
    args = parser.parse_args()
    for command in ("ffmpeg", "ffprobe", "espeak-ng"):
        if not shutil.which(command):
            raise SystemExit(f"Dependencia ausente: {command}")
    if not Path(FONT).exists():
        raise SystemExit("Fonte DejaVu nao encontrada")
    out = Path(args.saida)
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="ion-") as tmp:
        temp = Path(tmp)
        # Cada legenda usa arquivo próprio para evitar problemas com caracteres especiais.
        filters = [
            "drawbox=x=55:y=220:w=610:h=850:color=0x16345a:t=fill",
            "drawbox=x=325:y=310:w=70:h=610:color=0xffffff@0.65:t=fill",
            "drawbox=x=75:y=1010:w=570:h=10:color=yellow:t=fill",
        ]
        for i, (heading, caption) in enumerate(SCENES):
            start, end = i * DURATION / len(SCENES), (i + 1) * DURATION / len(SCENES)
            hfile = temp / f"title{i}.txt"
            cfile = temp / f"caption{i}.txt"
            hfile.write_text(heading, encoding="utf-8")
            cfile.write_text(caption, encoding="utf-8")
            enable = f"between(t\\,{start:.2f}\\,{end:.2f})"
            filters.append(
                f"drawtext=fontfile={FONT}:textfile={hfile}:fontcolor=white:"
                f"fontsize=35:x=(w-text_w)/2:y=105:enable='{enable}'"
            )
            filters.append(
                f"drawtext=fontfile={FONT}:textfile={cfile}:fontcolor=white:"
                f"fontsize=23:x=(w-text_w)/2:y=1110:enable='{enable}'"
            )
        narration = temp / "narracao.wav"
        full_text = " ".join(caption for _, caption in SCENES)
        run(["espeak-ng", "-v", "pt-br", "-s", "155", "-w", str(narration), full_text])
        # Evita cortar a narracao quando a sintese ultrapassa 15 segundos.
        audio_info = json.loads(run(["ffprobe", "-v", "error", "-show_entries",
            "format=duration", "-of", "json", str(narration)]).stdout)
        speech_seconds = float(audio_info["format"]["duration"])
        rate = max(1.0, speech_seconds / 14.5)
        if rate > 2.0:
            raise SystemExit(f"Narracao longa demais ({speech_seconds:.1f}s); reduza o roteiro.")
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", "color=c=0x0b172b:s=720x1280:r=25:d=15",
            "-i", str(narration), "-filter_complex",
            "[0:v]" + ",".join(filters) + "[v];[1:a]atempo=" + f"{rate:.5f}" + ",apad=whole_dur=15[a]",
            "-map", "[v]", "-map", "[a]", "-c:v", "libx264",
            "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-b:a", "128k", "-t", "15", "-movflags", "+faststart", str(out)
        ]
        run(cmd)
    info = json.loads(run(["ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_type,width,height", "-of", "json", str(out)]).stdout)
    streams = info["streams"]
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    if not video or not audio or video.get("width") != 720 or video.get("height") != 1280:
        raise SystemExit("Arquivo MP4 invalido: fluxos ou dimensoes incorretos")
    if not 14.8 <= float(info["format"]["duration"]) <= 15.2:
        raise SystemExit("Duracao invalida")
    print(f"MP4 validado: {out} | {info['format']['duration']}s | 720x1280 | audio e video")
    print("Aviso: prototipo com voz sintetizada e cenas graficas, sem imagens reais.")

if __name__ == "__main__":
    main()
