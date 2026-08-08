"""Generate Expense Track app icons with a dollar sign."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets" / "images"
IOS_ASSETS = ROOT / "assets" / "expo.icon" / "Assets"

ACCENT = (26, 122, 76, 255)  # #1A7A4C
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\seguisb.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_dollar(
    size: int,
    *,
    fill: tuple[int, int, int, int],
    background: tuple[int, int, int, int] | None = None,
    font_ratio: float = 0.62,
) -> Image.Image:
    img = Image.new("RGBA", (size, size), background or TRANSPARENT)
    draw = ImageDraw.Draw(img)
    font = load_font(int(size * font_ratio))
    text = "$"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) / 2 - bbox[0]
    y = (size - text_h) / 2 - bbox[1] - size * 0.02
    draw.text((x, y), text, font=font, fill=fill)
    return img


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG")
    print(f"wrote {path.relative_to(ROOT)} ({img.size[0]}x{img.size[1]})")


def write_dollar_svg(path: Path) -> None:
    svg = """<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <text
    x="512"
    y="540"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Arial Black, Arial, Helvetica, sans-serif"
    font-size="640"
    font-weight="800"
    fill="#FFFFFF">$</text>
</svg>
"""
    path.write_text(svg, encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)}")


def main() -> None:
    icon = draw_dollar(1024, fill=WHITE, background=ACCENT)
    save(icon, IMAGES / "icon.png")

    # Adaptive foreground keeps content in the center safe zone.
    foreground = draw_dollar(1024, fill=WHITE, background=None, font_ratio=0.48)
    save(foreground, IMAGES / "android-icon-foreground.png")

    background = Image.new("RGBA", (1024, 1024), ACCENT)
    save(background, IMAGES / "android-icon-background.png")

    monochrome = draw_dollar(1024, fill=WHITE, background=None, font_ratio=0.48)
    save(monochrome, IMAGES / "android-icon-monochrome.png")

    splash = draw_dollar(512, fill=WHITE, background=None, font_ratio=0.7)
    save(splash, IMAGES / "splash-icon.png")

    favicon = draw_dollar(48, fill=WHITE, background=ACCENT, font_ratio=0.7)
    save(favicon, IMAGES / "favicon.png")

    write_dollar_svg(IOS_ASSETS / "dollar-sign.svg")


if __name__ == "__main__":
    main()
