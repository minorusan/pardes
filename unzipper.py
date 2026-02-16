#!/usr/bin/env python3
"""
PARDES Library Unzipper Daemon
Reads zip paths from a text file, extracts one by one using 7z,
deletes the zip after successful extraction, logs everything.
Stops on any exception.
"""
import subprocess, sys, os, time
from pathlib import Path
from datetime import datetime

ZIPLIST = "/mnt/cache/library/zips/ziplist.txt"
EXTRACT_DIR = "/mnt/cache/library/extracted"
LOG_FILE = "/home/erkamen/pardes/unzip-progress.txt"
COMPLETED_FILE = "/home/erkamen/pardes/unzip-completed.txt"

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def get_completed():
    if not os.path.exists(COMPLETED_FILE):
        return set()
    with open(COMPLETED_FILE) as f:
        return set(l.strip() for l in f if l.strip())

def mark_completed(zip_path):
    with open(COMPLETED_FILE, "a") as f:
        f.write(zip_path + "\n")

def get_zip_info(zip_path):
    """Get compressed and uncompressed size using 7z l"""
    result = subprocess.run(
        ["7z", "l", zip_path],
        capture_output=True, text=True, timeout=120
    )
    # parse last summary line like "                   123456789   100   12345  123 files"
    for line in result.stdout.splitlines():
        parts = line.strip().split()
        if len(parts) >= 3 and parts[-1] == "files":
            try:
                uncompressed = int(parts[0])
                compressed = int(parts[1])
                file_count = int(parts[-2])
                return uncompressed, compressed, file_count
            except (ValueError, IndexError):
                pass
    return None, None, None

def extract(zip_path):
    """Extract zip using 7z, return elapsed time"""
    os.makedirs(EXTRACT_DIR, exist_ok=True)

    start = time.time()
    result = subprocess.run(
        ["7z", "x", zip_path, f"-o{EXTRACT_DIR}", "-y", "-bsp0"],
        capture_output=True, text=True, timeout=7200  # 2h max per zip
    )
    elapsed = time.time() - start

    if result.returncode != 0:
        log(f"  7z STDERR: {result.stderr.strip()}")
        log(f"  7z STDOUT: {result.stdout.strip()[-500:]}")
        raise RuntimeError(f"7z failed with code {result.returncode} on {zip_path}")

    return elapsed

def check_disk_space():
    """Return free space in GB"""
    st = os.statvfs(EXTRACT_DIR)
    free_gb = (st.f_bavail * st.f_frsize) / (1 << 30)
    return free_gb

def main():
    with open(ZIPLIST) as f:
        zips = [l.strip() for l in f if l.strip()]

    completed = get_completed()
    remaining = [z for z in zips if z not in completed]

    log(f"=== UNZIPPER STARTED ===")
    log(f"Total in list: {len(zips)}, Already done: {len(completed)}, Remaining: {len(remaining)}")

    for i, zip_path in enumerate(remaining):
        if not os.path.exists(zip_path):
            log(f"[{i+1}/{len(remaining)}] SKIP (not found): {zip_path}")
            continue

        zip_name = os.path.basename(zip_path)
        zip_size_gb = os.path.getsize(zip_path) / (1 << 30)

        # check disk before extracting
        free_gb = check_disk_space()
        log(f"[{i+1}/{len(remaining)}] {zip_name} ({zip_size_gb:.2f} GB) | Free: {free_gb:.1f} GB")

        if free_gb < 50:
            raise RuntimeError(f"Disk space critically low: {free_gb:.1f} GB free. Stopping.")

        # get info
        uncompressed, compressed, file_count = get_zip_info(zip_path)
        if uncompressed:
            ratio = uncompressed / compressed if compressed else 0
            uncomp_gb = uncompressed / (1 << 30)
            log(f"  Info: {file_count} files, {uncomp_gb:.2f} GB uncompressed, ratio {ratio:.1f}x")

            if uncomp_gb > free_gb - 20:
                raise RuntimeError(f"Not enough space: need ~{uncomp_gb:.1f} GB, have {free_gb:.1f} GB. Stopping.")

        # extract
        log(f"  Extracting...")
        elapsed = extract(zip_path)
        speed = zip_size_gb / (elapsed / 60) if elapsed > 0 else 0
        log(f"  Done in {elapsed:.0f}s ({speed:.2f} GB/min)")

        # delete original zip
        os.remove(zip_path)
        log(f"  Deleted {zip_name}")

        # mark completed
        mark_completed(zip_path)

        # post-extract disk check
        free_gb = check_disk_space()
        log(f"  Free space: {free_gb:.1f} GB")

    log(f"=== ALL DONE ===")

if __name__ == "__main__":
    main()
