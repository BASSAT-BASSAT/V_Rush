"""One-time export of MobileSAM to two ONNX files.

Run this from the ``backend/`` folder on a machine with PyTorch installed
(not needed on the Vercel server). Commits ``mobile_sam_encoder.onnx``
(~40 MB) and ``mobile_sam_decoder.onnx`` (~2 MB) next to the rest of the
backend.

Usage (one-time)::

    cd backend
    # Create a throwaway venv so PyTorch doesn't pollute your main env.
    python -m venv .sam-export
    .sam-export\\Scripts\\activate   # or source .sam-export/bin/activate on unix
    pip install torch==2.2.2 torchvision==0.17.2 onnx==1.16.* onnxruntime==1.17.* \
        git+https://github.com/ChaoningZhang/MobileSAM.git
    # Download the Apache-2.0 checkpoint (~40 MB):
    curl -LO https://github.com/ChaoningZhang/MobileSAM/raw/master/weights/mobile_sam.pt
    python scripts/export_mobile_sam.py
    git add mobile_sam_encoder.onnx mobile_sam_decoder.onnx

After export you can ``rm -rf .sam-export`` and ``rm mobile_sam.pt``.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import torch
from mobile_sam import sam_model_registry
from mobile_sam.utils.onnx import SamOnnxModel


def export(checkpoint: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[export] loading {checkpoint}")
    sam = sam_model_registry["vit_t"](checkpoint=str(checkpoint))
    sam.eval()

    # ---- encoder ----
    enc_path = out_dir / "mobile_sam_encoder.onnx"
    print(f"[export] encoder -> {enc_path}")
    dummy = torch.randn(1, 3, 1024, 1024)
    torch.onnx.export(
        sam.image_encoder,
        dummy,
        str(enc_path),
        input_names=["image"],
        output_names=["image_embeddings"],
        opset_version=17,
        dynamic_axes=None,
    )

    # ---- decoder ----
    dec_path = out_dir / "mobile_sam_decoder.onnx"
    print(f"[export] decoder -> {dec_path}")
    onnx_model = SamOnnxModel(sam, return_single_mask=True)
    embed_dim = sam.prompt_encoder.embed_dim
    embed_size = sam.prompt_encoder.image_embedding_size
    mask_input_size = (4 * embed_size[0], 4 * embed_size[1])
    dummy_inputs = {
        "image_embeddings": torch.randn(1, embed_dim, *embed_size, dtype=torch.float),
        "point_coords": torch.randint(low=0, high=1024, size=(1, 5, 2), dtype=torch.float),
        "point_labels": torch.randint(low=0, high=4, size=(1, 5), dtype=torch.float),
        "mask_input": torch.randn(1, 1, *mask_input_size, dtype=torch.float),
        "has_mask_input": torch.tensor([1], dtype=torch.float),
        "orig_im_size": torch.tensor([1200, 1800], dtype=torch.float),
    }
    output_names = ["masks", "iou_predictions", "low_res_masks"]
    torch.onnx.export(
        onnx_model,
        tuple(dummy_inputs.values()),
        str(dec_path),
        input_names=list(dummy_inputs.keys()),
        output_names=output_names,
        opset_version=17,
        dynamic_axes={
            "point_coords": {1: "num_points"},
            "point_labels": {1: "num_points"},
        },
    )

    print("[export] done.")
    print(f"  {enc_path}  ({enc_path.stat().st_size / 1_048_576:.1f} MB)")
    print(f"  {dec_path}  ({dec_path.stat().st_size / 1_048_576:.1f} MB)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", default="mobile_sam.pt", type=Path)
    parser.add_argument("--out-dir", default=Path("."), type=Path)
    args = parser.parse_args()
    export(args.checkpoint, args.out_dir)
