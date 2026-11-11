"""
Free Action Video Downloader for HAR Dataset Generation (NO API KEY REQUIRED)
=============================================================================
This script automatically searches and downloads 720p action clips
directly into class-specific folders without needing any API key or login.

Powered by yt-dlp.

Usage:
------
Run in terminal:
  python tools/download_dataset_free.py --count 10

Arguments:
  --count       Number of clips per class (default: 30)
  --output-dir  Directory to store videos (default: d:/ML_project/custom_dataset)
  --duration    Max duration of clips in seconds (default: 30s)
"""

import os
import sys
import argparse
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

try:
    import yt_dlp
except ImportError:
    print("yt-dlp is required. Installing now...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "yt-dlp"])
    import yt_dlp

# Target classes and specific search queries (Option B: Sports & Physical Fitness)
ACTION_CLASSES = {
    "pushups": [
        "person doing pushups workout stock video",
        "pushups exercise tutorial fitness clip",
        "athlete doing push ups floor gym video",
    ],
    "squats": [
        "person doing bodyweight squats exercise clip",
        "squat workout fitness stock video",
        "legs squat exercise training form footage",
    ],
    "jumping_jacks": [
        "person doing jumping jacks exercise clip",
        "jumping jacks workout fitness stock video",
        "jumping jacks cardio exercise tutorial",
    ],
    "swimming": [
        "person swimming freestyle pool stock video",
        "swimmer in swimming pool race clip",
        "swimming athlete pool footage",
    ],
    "cycling": [
        "person riding bicycle road stock video",
        "cyclist cycling outdoors footage",
        "biking on street outdoor clip",
    ],
    "boxing_punching": [
        "boxer punching heavy bag gym clip",
        "boxing punches shadowboxing workout video",
        "boxing training punch combo stock video",
    ],
}


def download_action_videos(
    class_name: str,
    search_queries: list[str],
    target_count: int,
    output_dir: Path,
    max_duration: int = 30,
):
    class_folder = output_dir / class_name
    class_folder.mkdir(parents=True, exist_ok=True)

    existing_files = list(class_folder.glob("*.mp4"))
    downloaded = len(existing_files)
    if downloaded >= target_count:
        print(f"[{class_name}] Already has {downloaded} clips. Skipping.")
        return

    print(f"\n" + "=" * 60)
    print(f"📥 Class: '{class_name}' | Target: {target_count} clips (Existing: {downloaded})")
    print("=" * 60)

    # yt-dlp format specification:
    # Get 720p mp4 video (or best video <= 720p)
    out_template = str(class_folder / f"{class_name}_%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
        "outtmpl": out_template,
        "quiet": False,
        "no_warnings": True,
        "ignoreerrors": True,
        # Only download clips between 3s and max_duration seconds
        "match_filter": yt_dlp.utils.match_filter_func(f"duration >= 3 & duration <= {max_duration}"),
        "postprocessors": [
            {
                "key": "FFmpegVideoConvertor",
                "preferedformat": "mp4",
            }
        ] if False else [],
    }

    needed = target_count - downloaded
    per_query = max(needed // len(search_queries) + 3, 5)

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for query in search_queries:
            if downloaded >= target_count:
                break

            search_target = f"ytsearch{per_query}:{query}"
            print(f"🔍 Searching YouTube for query: '{query}'...")

            try:
                res = ydl.extract_info(search_target, download=True)
                downloaded = len(list(class_folder.glob("*.mp4")))
                print(f"  -> Total downloaded for '{class_name}': {downloaded}/{target_count}")
            except Exception as e:
                print(f"  ⚠️ Error processing query '{query}': {e}")


def main():
    parser = argparse.ArgumentParser(description="Free automated action video downloader without API keys")
    parser.add_argument("--count", type=int, default=30, help="Clips per class (default: 30)")
    parser.add_argument("--duration", type=int, default=25, help="Max video length in seconds (default: 25)")
    parser.add_argument("--output-dir", type=str, default="d:/ML_project/custom_dataset", help="Output directory")
    args = parser.parse_args()

    out_path = Path(args.output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    print(f"🚀 Free Action Video Dataset Downloader (NO API KEY REQUIRED)")
    print(f"Output directory: {out_path.resolve()}")
    print(f"Target count:     {args.count} clips/class")
    print(f"Max clip length:  {args.duration}s\n")

    for class_name, queries in ACTION_CLASSES.items():
        download_action_videos(
            class_name=class_name,
            search_queries=queries,
            target_count=args.count,
            output_dir=out_path,
            max_duration=args.duration,
        )

    print("\n" + "=" * 60)
    print("🎉 Dataset Download Finished! Class summary:")
    for folder in sorted(out_path.iterdir()):
        if folder.is_dir():
            vids = list(folder.glob("*.mp4")) + list(folder.glob("*.mkv")) + list(folder.glob("*.webm"))
            print(f"  📁 {folder.name}: {len(vids)} video clips")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Compress 'custom_dataset' folder to a .zip file")
    print("2. Upload to Kaggle or import directly into your platform!")


if __name__ == "__main__":
    main()
