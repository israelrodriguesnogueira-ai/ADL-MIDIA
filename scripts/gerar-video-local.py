#!/usr/bin/env python3
"""Generate a review clip with a locally installed Wan2.2 TI2V-5B.

Use the official Wan2.2 install instructions and download the TI2V-5B
checkpoint before running. Run this script with the same Python environment.
The output is a short visual candidate for review and later finalization.
"""

import argparse
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wan", required=True, type=Path, help="Checkout of Wan2.2.")
    parser.add_argument("--pesos", required=True, type=Path, help="TI2V-5B checkpoint folder.")
    parser.add_argument("--imagem", required=True, type=Path, help="Vertical reference image.")
    parser.add_argument("--prompt", required=True, help="Describe the motion and details to preserve.")
    parser.add_argument("--saida", required=True, type=Path, help="Path for the review MP4.")
    args = parser.parse_args()

    generator = (args.wan / "generate.py").resolve()
    checkpoint = args.pesos.resolve()
    image = args.imagem.resolve()
    output = args.saida.resolve()
    if not generator.is_file() or not checkpoint.is_dir() or not image.is_file():
        parser.error("Confira os caminhos do Wan2.2, dos pesos e da imagem.")
    if not args.prompt.strip() or output.suffix.lower() != ".mp4":
        parser.error("Informe um prompt e um caminho de saída .mp4.")
    try:
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=".aion-wan-", dir=output.parent) as work:
            candidate = Path(work) / "previa.mp4"
            subprocess.run([
                sys.executable, str(generator), "--task", "ti2v-5B",
                "--size", "704*1280", "--ckpt_dir", str(checkpoint),
                "--offload_model", "True", "--convert_model_dtype", "--t5_cpu",
                "--image", str(image), "--prompt", args.prompt,
                "--save_file", str(candidate),
            ], cwd=generator.parent, check=True)
            subprocess.run([
                "ffmpeg", "-nostdin", "-v", "error", "-xerror", "-i", str(candidate),
                "-map", "0:V:0", "-f", "null", "-",
            ], check=True)
            candidate.replace(output)
    except (OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Falha na geração local: {error}\n")


if __name__ == "__main__":
    main()
