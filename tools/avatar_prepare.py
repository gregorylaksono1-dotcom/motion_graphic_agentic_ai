#!/usr/bin/env python3
"""
Avatar pack preparation for the motion-graphic pipeline.

Input folder (e.g. exported from your image generator):
  <pose>_<hash>.jpg   portrait images of the SAME character, mouthless face, white background
  mouth_<hash>.jpg    one landscape sheet with 6 mouth shapes in a 3x2 grid on white

Output: library/avatar/<id>/
  poses/<pose>.png        transparent sticker (white outline) — all on the same canvas size
  mouths/<viseme>.png     transparent mouth shapes
  avatar.json             manifest: poses, auto-estimated mouth anchors, viseme map
  calibration.png         preview of every pose with the 'A' mouth placed -> tweak anchors in avatar.json if needed

Usage:
  python3 tools/avatar_prepare.py --src "/path/to/avatar-images" --id my-presenter
  python3 tools/avatar_prepare.py --src ... --id ... --mouth-order rest,A,E,U,C,O --outline 12

Requires: pip install pillow numpy scipy
"""
import argparse
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

DEFAULT_MOUTH_ORDER = ["rest", "A", "E", "U", "C", "O"]

# Default semantic hints per pose name (used by the Director to pick poses). Unknown names get a generic hint.
POSE_HINTS = {
    "main_char": "neutral / introducing self / talking about 'saya' or 'kita'",
    "menjelaskan": "explaining, presenting a fact, open palm",
    "menunjuk": "pointing at on-screen data, 'lihat ini', emphasizing a detail",
    "kaget": "surprised, shocking number or twist ('bahkan', 'cuma', 'gila')",
    "berpikir": "thinking, asking a question, 'kenapa', doubt",
    "jempol": "approval, solution, positive result, CTA / follow",
}


def background_mask(rgb: np.ndarray, tol: int = 38) -> np.ndarray:
    """True where pixel is near-white AND connected to the image border (= background)."""
    near_white = np.all(rgb >= 255 - tol, axis=2)
    labels, _ = ndimage.label(near_white)
    border_labels = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    return np.isin(labels, list(border_labels))


def disk(radius: int) -> np.ndarray:
    y, x = np.ogrid[-radius : radius + 1, -radius : radius + 1]
    return x * x + y * y <= radius * radius


def cut_out(img: Image.Image, outline: int) -> tuple[Image.Image, np.ndarray]:
    rgb = np.asarray(img.convert("RGB")).astype(np.int16)
    fg = ~background_mask(rgb)
    fg = ndimage.binary_fill_holes(fg)
    # remove tiny specks
    labels, n = ndimage.label(fg)
    if n > 1:
        sizes = ndimage.sum(fg, labels, range(1, n + 1))
        keep = np.isin(labels, [i + 1 for i, s in enumerate(sizes) if s > 0.01 * fg.sum()])
        fg = keep
    h, w = fg.shape
    out = np.zeros((h, w, 4), dtype=np.uint8)
    if outline > 0:
        sticker = ndimage.binary_dilation(fg, structure=disk(outline))
        out[sticker] = [255, 255, 255, 255]
    alpha_char = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    char_rgba = np.dstack([np.asarray(img.convert("RGB")), np.asarray(alpha_char)])
    base = Image.fromarray(out, "RGBA")
    base.alpha_composite(Image.fromarray(char_rgba, "RGBA"))
    return base, fg


def estimate_mouth_anchor(fg: np.ndarray) -> dict:
    """Heuristic: head = rows above the shoulders; mouth ~ 76% down the head, centered on the face columns."""
    rows = np.where(fg.any(axis=1))[0]
    top, bottom = int(rows[0]), int(rows[-1])
    widths = fg.sum(axis=1)
    span = bottom - top
    head_zone = widths[top : top + int(span * 0.45)]
    head_w = np.median(head_zone[int(len(head_zone) * 0.15) : int(len(head_zone) * 0.6)])
    # shoulders: first row (below 25% of span) whose width exceeds 1.7x the head width
    shoulder = top + int(span * 0.25)
    for r in range(top + int(span * 0.2), bottom):
        if widths[r] > 1.7 * head_w:
            shoulder = r
            break
    # chin ~ narrowest row between 60% of head and shoulders
    search_from = top + int((shoulder - top) * 0.6)
    neck = search_from + int(np.argmin(widths[search_from:shoulder])) if shoulder > search_from else shoulder
    head_h = neck - top
    mouth_y = top + int(head_h * 0.80)
    cols = np.where(fg[mouth_y])[0]
    # face columns at mouth row: take the widest contiguous run
    runs = np.split(cols, np.where(np.diff(cols) != 1)[0] + 1)
    run = max(runs, key=len)
    face_w = int(run[-1] - run[0])
    return {
        "x": int((run[0] + run[-1]) / 2),
        "y": mouth_y,
        "width": int(face_w * 0.30),
        "rotate": 0,
        "_auto": True,
    }


def split_mouth_sheet(img: Image.Image, order: list[str]) -> dict[str, Image.Image]:
    rgb = np.asarray(img.convert("RGB")).astype(np.int16)
    ink = ~np.all(rgb >= 225, axis=2)
    merged = ndimage.binary_dilation(ink, structure=disk(18))
    labels, n = ndimage.label(merged)
    boxes = []
    for i in range(1, n + 1):
        ys, xs = np.where(labels == i)
        if len(ys) < 400:
            continue
        boxes.append((ys.min(), ys.max(), xs.min(), xs.max()))
    if len(boxes) != len(order):
        print(f"⚠️  Found {len(boxes)} mouth shapes but mouth-order has {len(order)} names", file=sys.stderr)
    # row-major order: group by row using vertical centers
    h = rgb.shape[0]
    boxes.sort(key=lambda b: (0 if (b[0] + b[1]) / 2 < h / 2 else 1, (b[2] + b[3]) / 2))
    result = {}
    for name, (y0, y1, x0, x1) in zip(order, boxes):
        pad = 6
        crop = img.crop((max(0, x0 - pad), max(0, y0 - pad), x1 + pad, y1 + pad))
        cut, _ = cut_out(crop, outline=0)
        result[name] = cut
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--id", required=True)
    ap.add_argument("--out", default="library/avatar")
    ap.add_argument("--outline", type=int, default=12)
    ap.add_argument("--mouth-order", default=",".join(DEFAULT_MOUTH_ORDER))
    args = ap.parse_args()

    out_dir = os.path.join(args.out, args.id)
    os.makedirs(os.path.join(out_dir, "poses"), exist_ok=True)
    os.makedirs(os.path.join(out_dir, "mouths"), exist_ok=True)

    files = sorted(f for f in os.listdir(args.src) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
    mouth_files = [f for f in files if f.lower().startswith("mouth")]
    pose_files = [f for f in files if f not in mouth_files]
    if not mouth_files:
        sys.exit("No mouth sheet found (file name must start with 'mouth')")

    poses = []
    canvas = None
    for f in pose_files:
        name = re.sub(r"_[0-9a-f]{6,}$", "", os.path.splitext(f)[0])
        img = Image.open(os.path.join(args.src, f))
        canvas = canvas or img.size
        if img.size != canvas:
            print(f"⚠️  {f} has size {img.size}, expected {canvas} — poses should share one canvas", file=sys.stderr)
        sticker, fg = cut_out(img, args.outline)
        sticker.save(os.path.join(out_dir, "poses", f"{name}.png"))
        ys, xs = np.where(fg)
        poses.append(
            {
                "id": name,
                "file": f"poses/{name}.png",
                "hint": POSE_HINTS.get(name, "general talking pose"),
                "mouth": estimate_mouth_anchor(fg),
                "contentBox": {"x0": int(xs.min()), "y0": int(ys.min()), "x1": int(xs.max()), "y1": int(ys.max())},
            }
        )
        print(f"✅ pose {name}: mouth anchor {poses[-1]['mouth']}")

    order = [s.strip() for s in args.mouth_order.split(",")]
    mouths = split_mouth_sheet(Image.open(os.path.join(args.src, mouth_files[0])), order)
    mouth_meta = {}
    for name, im in mouths.items():
        im.save(os.path.join(out_dir, "mouths", f"{name}.png"))
        mouth_meta[name] = {"file": f"mouths/{name}.png", "w": im.width, "h": im.height}
    ref_w = mouth_meta.get("A", next(iter(mouth_meta.values())))["w"]

    manifest = {
        "id": args.id,
        "canvas": {"width": canvas[0], "height": canvas[1]},
        "defaultPose": "main_char" if any(p["id"] == "main_char" for p in poses) else poses[0]["id"],
        "poses": poses,
        "mouths": mouth_meta,
        # mouth.width in each pose = rendered width of the 'A' mouth; other mouths keep their relative size
        "mouthReferenceWidth": ref_w,
        # viseme -> mouth image (M = lips closed for m/b/p)
        "visemeMap": {"REST": "rest", "M": "rest", "A": "A", "E": "E", "I": "E", "O": "O", "U": "U", "C": "C"},
    }
    with open(os.path.join(out_dir, "avatar.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)

    render_calibration(out_dir, manifest)
    print(f"\n📦 Avatar pack written to {out_dir}. Check calibration.png and tweak poses[].mouth in avatar.json if needed.")


def render_calibration(out_dir: str, manifest: dict):
    thumbs = []
    mouth_a = Image.open(os.path.join(out_dir, manifest["mouths"]["A"]["file"]))
    for p in manifest["poses"]:
        im = Image.open(os.path.join(out_dir, p["file"])).convert("RGBA")
        m = p["mouth"]
        scale = m["width"] / manifest["mouthReferenceWidth"]
        mw, mh = int(mouth_a.width * scale), int(mouth_a.height * scale)
        mouth = mouth_a.resize((max(1, mw), max(1, mh))).rotate(-m.get("rotate", 0), expand=True)
        im.alpha_composite(mouth, (int(m["x"] - mouth.width / 2), int(m["y"] - mouth.height / 2)))
        draw = ImageDraw.Draw(im)
        draw.text((20, 20), p["id"], fill=(220, 0, 0, 255))
        bg = Image.new("RGBA", im.size, (40, 52, 110, 255))
        bg.alpha_composite(im)
        thumbs.append(bg.resize((im.width // 2, im.height // 2)))
    sheet = Image.new("RGBA", (sum(t.width for t in thumbs), thumbs[0].height), (0, 0, 0, 255))
    x = 0
    for t in thumbs:
        sheet.paste(t, (x, 0))
        x += t.width
    sheet.convert("RGB").save(os.path.join(out_dir, "calibration.png"))


if __name__ == "__main__":
    main()
