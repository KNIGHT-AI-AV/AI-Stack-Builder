#!/usr/bin/env python3
"""Derive AI Stack Builder web, PWA, and iOS icons from the generated alpha master."""

from __future__ import annotations

import argparse
import io
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "public/assets/brand/master/ai-stack-builder-mark-alpha.png"
ICONS = ROOT / "public/assets/brand/icons"
APP = ROOT / "src/app"

TRANSPARENT_SIZES = (16, 32, 48, 180, 192, 512, 1024)
MASKABLE_SIZES = (192, 512)
BACKGROUND = (8, 8, 10, 255)


def load_master() -> Image.Image:
    image = Image.open(MASTER).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("alpha master is fully transparent")
    if alpha.getextrema() != (0, 255):
        raise ValueError("alpha master must contain transparent and opaque pixels")
    corners = ((0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1))
    if any(image.getpixel(point)[3] != 0 for point in corners):
        raise ValueError("alpha master corners must be transparent")
    return image.crop(bbox)


def fitted_mark(mark: Image.Image, size: int, fill: float, background: tuple[int, int, int, int] | None) -> Image.Image:
    target_height = max(1, round(size * fill))
    target_width = max(1, round(target_height * mark.width / mark.height))
    resized = mark.resize((target_width, target_height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    x = (size - target_width) // 2
    y = (size - target_height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def expected_assets() -> dict[Path, Image.Image]:
    mark = load_master()
    assets: dict[Path, Image.Image] = {}

    for size in TRANSPARENT_SIZES:
        assets[ICONS / f"ai-stack-builder-icon-{size}.png"] = fitted_mark(mark, size, 0.88, None)

    for size in MASKABLE_SIZES:
        assets[ICONS / f"ai-stack-builder-icon-maskable-{size}.png"] = fitted_mark(mark, size, 0.68, BACKGROUND).convert("RGB")

    assets[ICONS / "ai-stack-builder-icon-apple-180.png"] = fitted_mark(mark, 180, 0.76, BACKGROUND).convert("RGB")
    assets[ICONS / "ai-stack-builder-icon-ios-1024.png"] = fitted_mark(mark, 1024, 0.76, BACKGROUND).convert("RGB")
    assets[APP / "icon.png"] = assets[ICONS / "ai-stack-builder-icon-512.png"].copy()
    assets[APP / "apple-icon.png"] = assets[ICONS / "ai-stack-builder-icon-apple-180.png"].copy()
    return assets


def save_png(path: Path, image: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True, compress_level=9)


def favicon_bytes(assets: dict[Path, Image.Image]) -> bytes:
    source = assets[ICONS / "ai-stack-builder-icon-48.png"]
    output = io.BytesIO()
    source.save(output, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    return output.getvalue()


def build() -> None:
    assets = expected_assets()
    for path, image in assets.items():
        save_png(path, image)
    (APP / "favicon.ico").write_bytes(favicon_bytes(assets))


def assert_pixels_equal(path: Path, expected: Image.Image) -> None:
    if not path.is_file():
        raise AssertionError(f"missing asset: {path.relative_to(ROOT)}")
    actual = Image.open(path)
    if actual.size != expected.size:
        raise AssertionError(f"wrong dimensions for {path.relative_to(ROOT)}: {actual.size} != {expected.size}")
    actual_normalized = actual.convert(expected.mode)
    if ImageChops.difference(actual_normalized, expected).getbbox() is not None:
        raise AssertionError(f"pixel drift in {path.relative_to(ROOT)}; run the builder")


def check_alpha_contract(path: Path, should_be_opaque: bool) -> None:
    image = Image.open(path)
    alpha = image.convert("RGBA").getchannel("A")
    extrema = alpha.getextrema()
    if should_be_opaque and extrema != (255, 255):
        raise AssertionError(f"opaque asset contains transparency: {path.relative_to(ROOT)}")
    if not should_be_opaque and extrema != (0, 255):
        raise AssertionError(f"transparent asset has invalid alpha range: {path.relative_to(ROOT)} {extrema}")


def check() -> None:
    assets = expected_assets()
    for path, expected in assets.items():
        assert_pixels_equal(path, expected)

    transparent_paths: Iterable[Path] = (
        ICONS / f"ai-stack-builder-icon-{size}.png" for size in TRANSPARENT_SIZES
    )
    for path in transparent_paths:
        check_alpha_contract(path, should_be_opaque=False)

    opaque_paths = [
        *(ICONS / f"ai-stack-builder-icon-maskable-{size}.png" for size in MASKABLE_SIZES),
        ICONS / "ai-stack-builder-icon-apple-180.png",
        ICONS / "ai-stack-builder-icon-ios-1024.png",
        APP / "apple-icon.png",
    ]
    for path in opaque_paths:
        check_alpha_contract(path, should_be_opaque=True)

    favicon = APP / "favicon.ico"
    if not favicon.is_file():
        raise AssertionError("missing src/app/favicon.ico")
    with Image.open(favicon) as icon:
        declared_sizes = icon.info.get("sizes", set())
        required = {(16, 16), (32, 32), (48, 48)}
        if not required.issubset(declared_sizes):
            raise AssertionError(f"favicon is missing sizes: {sorted(required - declared_sizes)}")

    print(f"Brand assets verified: {len(assets) + 1} files")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="validate committed derivatives without rewriting them")
    args = parser.parse_args()
    if args.check:
        check()
    else:
        build()
        check()


if __name__ == "__main__":
    main()
