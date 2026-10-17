#!/usr/bin/env python3
"""Build the native Clockology .clock2 face from the bundled watch assets."""

from __future__ import annotations

import json
import plistlib
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OCS_FILE = ROOT / "CosmosWhisper-Apple-Watch.ocs"
OUTPUT_FILE = ROOT / "CosmosWhisper-Apple-Watch.clock2"
PREVIEW_FILE = ROOT / "CosmosWhisper-Apple-Watch-preview.png"


def new_id() -> str:
    return str(uuid.uuid4()).upper()


def load_assets() -> dict[str, str]:
    ocs = json.loads(OCS_FILE.read_text(encoding="utf-8-sig"))
    return {item["filename"]: item["imageData"] for item in ocs["assets"]}


def default_layer(layer_type: str, *, name: str, width: int, height: int,
                  image_name: str, image_data: str) -> dict:
    """Use Clockology's schema-v3 layer keys and settings defaults."""
    return {
        "colorHex": "#ffffffff",
        "uid": new_id(),
        "shadowRadius": 1,
        "rotAngle": 0,
        "isCustomColor": True,
        "colorType2": "white",
        "dateLayerSetting": {"formatType": "DD", "customFormat": ""},
        "imageStripLayerSetting": {
            "renderType": "framed",
            "timeWindowType": "dayOfMonth",
            "horizInput": False,
        },
        "ringLayerSetting": {
            "numItems": 12,
            "itemScale": 1,
            "pattern": "allOn",
            "rotateItems": False,
            "shapeType": "thinBox",
            "paddingScale": 1,
            "type": "numbers",
            "renderShape": "circle",
            "text": "",
        },
        "shadowColorHex": "#AAAAAAFF",
        "shadowXPosition": 1,
        "secondHandLayerSetting": {"animationFormat": "smooth"},
        "xPos": 0,
        "isForegroundLayer": layer_type == "hand",
        "colorHex2": "#FFFFFFFF",
        "type": layer_type,
        "customLayerName": name,
        "gradientType": "linear",
        "isCustomShadowEnabled": True,
        "yPos": 0,
        "gradientStartPoint": "top",
        "weatherLayerSetting": {
            "formatType": "city",
            "futurTimeType": "oneHour",
            "timeSpanType": "current",
            "isAmPm": False,
            "isMulticolorSFSymbol": True,
        },
        "videoLayerSetting": {"loops": True},
        "name": "",
        "gradientEndPoint": "bottom",
        "height": height,
        "isHidden": False,
        "minuteHandLayerSetting": {"animationFormat": "step"},
        "iconSize": 20,
        "alpha": 1,
        "shapeLayerSetting": {
            "outlineColorHex": "#FFFFFFFF",
            "outlineColor": "white",
            "isOutlineCustomColor": False,
            "outlineWidth": 0,
            "cornerRadius": 18,
            "shapeType": "circle",
        },
        "parallaxAmount": 0,
        "dataLabelLayerSetting": {"kind": "stepCount"},
        "isGradient": False,
        "textLayerSetting": {
            "ptSize": 56,
            "fontType": "custom",
            "fontFilename": "",
            "casingType": "unmodified",
            "fontName": "",
            "adjustBaselines": False,
            "weightType": "regular",
            "detailLevel": "unmodified",
        },
        "isCustomColor2": False,
        "shadowColorType": "white",
        "dataRingLayerSetting": {
            "backgroundColorHex": "#FFFFFF00",
            "style": "rounded",
            "backgroundColorType": "lightClear",
            "startColorType": "white",
            "autoColor": True,
            "thickness": 20,
            "isEndCustomColor": False,
            "format": "energyBurned",
            "isStartCustomColor": False,
            "endColorHex": "#FFFFFFFF",
            "endColorType": "white",
            "startColorHex": "#FFFFFFFF",
            "isBackgroundCustomColor": False,
            "endAngle": 360,
        },
        "handLayerSetting": {
            "useTint": False,
            "kind": "twelveHours",
            "vectorStyle": "rounded",
            "endAngle": 360,
            "clockwiseRotation": True,
            "format": "image",
        },
        "alignment": "center",
        "timeLayerSetting": {
            "formatType": "AMPM",
            "gmtOffsetEnabled": False,
            "gmtOffset": 0,
            "showTimeZoneStepperView": False,
            "customFormat": "",
        },
        "isAutomaticFrame": False,
        "colorType": "white",
        "imageLayerSetting": {
            "useTint": False,
            "contentMode": "fit",
            "preserveTransparency": True,
            "scaleFactor": 3,
            "filename": image_name,
            "saturation": 1,
            "imageData": image_data,
        },
        "iconLayerSetting": {
            "thickness": 3,
            "type": "heart",
            "category": "commonly_used",
            "isMoonPhase": False,
        },
        "shadowYPosition": 1,
        "width": width,
    }


def make_face(assets: dict[str, str]) -> dict:
    layers = []

    background_name = "CosmosWhisper-Apple-Watch-background.png"
    layers.append(default_layer(
        "image",
        name="CosmosWhisper star chart and outer ring",
        width=199,
        height=242,
        image_name=background_name,
        image_data=assets[background_name],
    ))
    layers[-1]["isForegroundLayer"] = False
    layers[-1]["imageLayerSetting"]["preserveTransparency"] = False

    for image_name, label, kind in [
        ("hour.png", "Hour hand", "twelveHours"),
        ("minute.png", "Minute hand", "minute"),
        ("second.png", "Sweeping second hand", "seconds"),
    ]:
        hand = default_layer(
            "hand",
            name=label,
            width=199,
            height=242,
            image_name=image_name,
            image_data=assets[image_name],
        )
        hand["handLayerSetting"]["kind"] = kind
        hand["handLayerSetting"]["format"] = "image"
        hand["imageLayerSetting"]["preserveTransparency"] = True
        hand["secondHandLayerSetting"]["animationFormat"] = "smooth"
        layers.append(hand)

    pivot_name = "pivot.png"
    pivot = default_layer(
        "image",
        name="Hand pivot",
        width=199,
        height=242,
        image_name=pivot_name,
        image_data=assets[pivot_name],
    )
    pivot["isForegroundLayer"] = True
    layers.append(pivot)

    now = time.time() - 978307200  # CFAbsoluteTime (seconds since 2001-01-01).
    main_complication = {
        "schemaVersion": 3,
        "subscriberProtected": False,
        "id": new_id(),
        "date": now,
        "longDescription": "CosmosWhisper Apple Watch astronomical dial",
        "tag": {"name": "", "color": {"hexValue": ""}},
        "clkComplicatonFamily": 999,
        "name": "",
        "minutesWarning": 60,
        "layerSettings": layers,
    }
    complications = [main_complication]
    for _ in range(6):
        complications.append({
            "schemaVersion": 3,
            "subscriberProtected": False,
            "id": new_id(),
            "date": now,
            "longDescription": "",
            "tag": {"name": "", "color": {"hexValue": ""}},
            "clkComplicatonFamily": 7,
            "name": "",
            "minutesWarning": 60,
            "layerSettings": [],
        })

    return {
        "schemaVersion": 3,
        "faceFamily": "fullScreen",
        "id": new_id(),
        "profileSetting": {},
        "origFilename": OUTPUT_FILE.name,
        "subscriberProtected": False,
        "familySettings": {
            "colorStyle": "multicolor",
            "backgroundStyle": "normalBlack",
            "backgroundColorStyle": "multicolor",
        },
        "complicationSettings": complications,
        "name": "CosmosWhisper Apple Watch",
    }


def make_archive(face: dict) -> dict:
    thumbnail = PREVIEW_FILE.read_bytes()

    # Clockology stores its face JSON and thumbnail under an NSKeyedArchiver
    # NSDictionary root inside a binary property list.
    objects = [
        "$null",
        {
            "NS.keys": [plistlib.UID(2), plistlib.UID(3)],
            "NS.objects": [plistlib.UID(4), plistlib.UID(5)],
            "$class": plistlib.UID(6),
        },
        "faceSettingsData",
        "thumbnailImageData",
        json.dumps(face, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        thumbnail,
        {"$classes": ["NSDictionary", "NSObject"], "$classname": "NSDictionary"},
    ]
    return {
        "$version": 100000,
        "$archiver": "NSKeyedArchiver",
        "$top": {"root": plistlib.UID(1)},
        "$objects": objects,
    }


def main() -> None:
    assets = load_assets()
    face = make_face(assets)
    archive = make_archive(face)
    OUTPUT_FILE.write_bytes(plistlib.dumps(archive, fmt=plistlib.FMT_BINARY, sort_keys=False))
    print(f"Wrote {OUTPUT_FILE.name} ({OUTPUT_FILE.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
