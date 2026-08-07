"""
ROI calibration helper — extracts frame 500 from a video and saves the
current scoreboard ROI crop as roi_check.png.

Usage:
    python scripts/calibrate_roi.py path/to/match.mp4

After inspecting roi_check.png, update the ROI_* constants at the top of
packages/ingestion/src/ingestion/scoreboard_ocr.py to match the actual
scoreboard position in your footage.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2

# Import the current ROI settings so this script always reflects the module.
from ingestion.scoreboard_ocr import ROI_HEIGHT, ROI_WIDTH, ROI_X, ROI_Y

_TARGET_FRAME = 3000
_OUTPUT = Path("roi_check.png")


def main() -> None:
    parser = argparse.ArgumentParser(description="Dump the scoreboard ROI from a video frame.")
    parser.add_argument("video", type=Path, help="Path to the match video (MP4)")
    args = parser.parse_args()

    video_path: Path = args.video
    if not video_path.exists():
        print(f"Error: video not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"Error: cannot open video: {video_path}", file=sys.stderr)
        sys.exit(1)

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    target = min(_TARGET_FRAME, max(0, total - 1))

    cap.set(cv2.CAP_PROP_POS_FRAMES, target)
    ok, frame = cap.read()
    cap.release()

    if not ok:
        print(f"Error: could not read frame {target}", file=sys.stderr)
        sys.exit(1)

    roi = frame[ROI_Y : ROI_Y + ROI_HEIGHT, ROI_X : ROI_X + ROI_WIDTH]
    cv2.imwrite(str(_OUTPUT), roi)

    print(f"Frame {target} ROI saved to {_OUTPUT.resolve()}")
    print(f"Current ROI: x={ROI_X}, y={ROI_Y}, w={ROI_WIDTH}, h={ROI_HEIGHT}")
    print("Update ROI_* constants in scoreboard_ocr.py if the crop does not show the scoreboard.")


if __name__ == "__main__":
    main()
