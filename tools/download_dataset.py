"""
Pexels Automated Video Downloader for HAR Dataset Generation
============================================================
This script searches and downloads 720p HD videos from Pexels for custom action classes.

Setup:
1. Get a FREE Pexels API Key: https://www.pexels.com/api/ (takes 1 minute, no credit card required)
2. Run command:
   pip install requests
3. Execute:
   python download_dataset.py --api-key YOUR_PEXELS_API_KEY --count 50
"""

import os
import sys
import time
import argparse
from pathlib import Path
import requests

# Default action classes and matching search terms
DEFAULT_CLASSES = {
    "violence": ["violence altercation", "physical aggression cctv", "street violence"],
    "shooting": ["gun shooting target", "firearm shooting range", "shooting gun weapon"],
    "road_accident": ["car accident crash", "road accident collision", "vehicle collision crash"],
    "jumping_jacks": ["jumping jacks exercise", "person doing jumping jacks", "jumping jacks workout"],
    "swimming": ["person swimming pool", "swimmer swimming freestyle", "swimming laps athlete"],
    "fighting": ["street fight brawl", "boxing martial arts fighting", "people fighting combat"],
}

def get_best_720p_video_file(video_files: list) -> dict | None:
    """Finds HD/720p video file from Pexels video files list, or closest match."""
    # 1. Try finding exact 720p (height 720 or width 1280)
    for vf in video_files:
        if vf.get("file_type") == "video/mp4":
            height = vf.get("height", 0)
            width = vf.get("width", 0)
            if height == 720 or width == 1280 or vf.get("quality") == "hd":
                return vf

    # 2. Fallback to any mp4 with reasonable resolution (between 480 and 1080)
    mp4_files = [f for f in video_files if f.get("file_type") == "video/mp4"]
    if mp4_files:
        # Sort by proximity to 720p
        mp4_files.sort(key=lambda x: abs((x.get("height") or 0) - 720))
        return mp4_files[0]

    return None


def download_videos_for_class(
    api_key: str,
    class_name: str,
    search_queries: list[str],
    target_count: int,
    output_dir: Path,
):
    headers = {"Authorization": api_key}
    class_folder = output_dir / class_name
    class_folder.mkdir(parents=True, exist_ok=True)

    # Check existing count
    existing_videos = list(class_folder.glob("*.mp4"))
    downloaded = len(existing_videos)
    if downloaded >= target_count:
        print(f"[{class_name}] Already has {downloaded} videos. Skipping.")
        return

    print(f"\n=======================================================")
    print(f"📥 Class: '{class_name}' | Target: {target_count} clips (Existing: {downloaded})")
    print(f"=======================================================")

    seen_video_ids = set()
    page = 1

    for query in search_queries:
        if downloaded >= target_count:
            break

        print(f"🔍 Searching Pexels for '{query}'...")

        while downloaded < target_count:
            url = f"https://api.pexels.com/videos/search?query={requests.utils.quote(query)}&per_page=40&page={page}"
            try:
                resp = requests.get(url, headers=headers, timeout=15)
                if resp.status_code == 429:
                    print("⚠️ Rate limit reached. Sleeping 60s...")
                    time.sleep(60)
                    continue
                if resp.status_code != 200:
                    print(f"Error {resp.status_code}: {resp.text}")
                    break

                data = resp.json()
                videos = data.get("videos", [])
                if not videos:
                    break

                for video in videos:
                    if downloaded >= target_count:
                        break

                    v_id = video.get("id")
                    if v_id in seen_video_ids:
                        continue
                    seen_video_ids.add(v_id)

                    duration = video.get("duration", 0)
                    # Filter for clips between 2s and 25s
                    if duration < 2 or duration > 25:
                        continue

                    best_file = get_best_720p_video_file(video.get("video_files", []))
                    if not best_file or not best_file.get("link"):
                        continue

                    download_url = best_file["link"]
                    file_name = f"{class_name}_{downloaded + 1:04d}_{v_id}.mp4"
                    file_path = class_folder / file_name

                    if file_path.exists():
                        downloaded += 1
                        continue

                    try:
                        print(f"  ⬇️ ({downloaded + 1}/{target_count}) Downloading {file_name} ({best_file.get('width')}x{best_file.get('height')}, {duration}s)...")
                        v_resp = requests.get(download_url, stream=True, timeout=30)
                        if v_resp.status_code == 200:
                            with open(file_path, "wb") as f:
                                for chunk in v_resp.iter_content(chunk_size=1024 * 1024):
                                    if chunk:
                                        f.write(chunk)
                            downloaded += 1
                        else:
                            print(f"    Failed download HTTP {v_resp.status_code}")
                    except Exception as err:
                        print(f"    Download error: {err}")
                        if file_path.exists():
                            file_path.unlink()

                    # polite throttle
                    time.sleep(0.5)

                if page * 40 >= data.get("total_results", 0):
                    break
                page += 1

            except Exception as e:
                print(f"Request error: {e}")
                break


def main():
    parser = argparse.ArgumentParser(description="Auto-download action videos from Pexels API in 720p HD")
    parser.add_argument("--api-key", type=str, required=True, help="Your Pexels API key")
    parser.add_argument("--count", type=int, default=150, help="Number of video clips to download per class (default: 150)")
    parser.add_argument("--output-dir", type=str, default="d:/ML_project/custom_dataset", help="Output directory")
    args = parser.parse_args()

    out_path = Path(args.output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    print(f"Starting HAR Dataset Downloader...")
    print(f"Target count: {args.count} clips/class")
    print(f"Output directory: {out_path.resolve()}\n")

    for class_name, queries in DEFAULT_CLASSES.items():
        download_videos_for_class(
            api_key=args.api_key,
            class_name=class_name,
            search_queries=queries,
            target_count=args.count,
            output_dir=out_path,
        )

    print("\n🎉 Download finished! Your dataset structure:")
    for p in out_path.iterdir():
        if p.is_dir():
            print(f"  📁 {p.name}: {len(list(p.glob('*.mp4')))} videos")

    print("\nNext steps:")
    print("1. Zip the 'custom_dataset' folder into 'custom_dataset.zip'")
    print("2. Upload to Kaggle Dataset or directly to this platform!")

if __name__ == "__main__":
    main()
