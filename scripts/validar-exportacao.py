#!/usr/bin/env python3
"""Valida uma exportação vertical. Requer Python 3, ffprobe e ffmpeg."""

import argparse
import json
from pathlib import Path
import subprocess
import sys


def executar(comando):
    return subprocess.run(
        comando, check=True, capture_output=True, text=True, timeout=120
    ).stdout


def validar(arquivo, exigir_audio):
    dados = json.loads(executar([
        "ffprobe", "-v", "error", "-show_streams", "-of", "json", str(arquivo)
    ]))
    faixas = dados.get("streams", [])
    video = next(
        (faixa for faixa in faixas if faixa.get("codec_type") == "video"
         and not faixa.get("disposition", {}).get("attached_pic")),
        None,
    )
    if video is None:
        raise ValueError("o arquivo não contém uma faixa de vídeo")
    largura, altura = video["width"], video["height"]
    if not largura or not altura or largura * 16 != altura * 9:
        raise ValueError(f"o vídeo tem {largura}×{altura}. Esperado formato 9:16")
    audio = next((faixa for faixa in faixas if faixa.get("codec_type") == "audio"), None)
    if exigir_audio and audio is None:
        raise ValueError("o arquivo não contém a faixa de áudio exigida")

    mapas = ["-map", f"0:{video['index']}"]
    if audio is not None:
        mapas += ["-map", f"0:{audio['index']}"]
    progresso = executar([
        "ffmpeg", "-nostdin", "-v", "error", "-xerror", "-i", str(arquivo),
        *mapas, "-progress", "pipe:1", "-f", "null", "-"
    ])
    quadros = [int(linha.partition("=")[2]) for linha in progresso.splitlines()
               if linha.startswith("frame=")]
    if not any(quadros):
        raise ValueError("nenhum quadro de vídeo pôde ser reproduzido")
    return largura, altura, audio is not None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("arquivo", type=Path)
    parser.add_argument("--exigir-audio", action="store_true")
    args = parser.parse_args()
    try:
        largura, altura, audio = validar(args.arquivo.resolve(strict=True), args.exigir_audio)
    except FileNotFoundError as erro:
        print(f"Falha: arquivo ou ferramenta ausente ({erro.filename}).", file=sys.stderr)
        return 1
    except subprocess.TimeoutExpired:
        print("Falha: o limite de tempo para validar o arquivo foi atingido.", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as erro:
        print(f"Falha ao ler ou decodificar o arquivo: {erro.stderr.strip()}", file=sys.stderr)
        return 1
    except ValueError as erro:
        print(f"Falha: {erro}.", file=sys.stderr)
        return 1
    print(f"OK: vídeo {largura}×{altura} decodificado. Áudio: {'presente' if audio else 'ausente'}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
