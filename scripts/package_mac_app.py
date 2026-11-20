#!/usr/bin/env python3
import argparse
import glob
import os
import re
import shutil
import subprocess
import sys

LSREGISTER = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"


def get_signing_identity():
    """Check for an Apple Developer ID or valid code signing certificate."""
    try:
        out = subprocess.check_output(["security", "find-identity", "-v", "-p", "codesigning"], text=True)
        for line in out.splitlines():
            line = line.strip()
            if "Developer ID Application:" in line or "Apple Development:" in line:
                parts = line.split('"', 2)
                if len(parts) >= 2:
                    return parts[1]
    except Exception:
        pass
    return "-"  # Default to Ad-Hoc signing if no developer certificate found


def sign_app(app_path, entitlements_path, identity):
    """Deep sign macOS application bundle sealing all frameworks and resources."""
    print(f"[*] Code signing bundle at: {app_path} (Identity: {identity})...")
    cmd = [
        "codesign",
        "--force",
        "--deep",
        "--options", "runtime",
        "--entitlements", entitlements_path,
        "--sign", identity,
        app_path,
    ]
    res = subprocess.run(cmd)
    if res.returncode != 0 and identity != "-":
        print("[!] Developer certificate keychain locked; falling back to ad-hoc signature ('-')...")
        cmd_adhoc = [
            "codesign",
            "--force",
            "--deep",
            "--options", "runtime",
            "--entitlements", entitlements_path,
            "--sign", "-",
            app_path,
        ]
        subprocess.run(cmd_adhoc, check=True)
    elif res.returncode != 0:
        raise subprocess.CalledProcessError(res.returncode, cmd)
    subprocess.run(["codesign", "--verify", "--deep", "--strict", "--verbose=2", app_path], check=True)
    print(f"[✓] Code signature verified on {app_path}")


def clean_quarantine(app_path):
    """Remove quarantine attributes so Gatekeeper allows immediate launch."""
    subprocess.run(["xattr", "-cr", app_path], check=False)


def refresh_launch_services(app_path):
    """Force macOS LaunchServices to pick up the replaced app bundle."""
    if os.path.exists(LSREGISTER):
        subprocess.run([LSREGISTER, "-f", app_path], check=False)


def clear_webkit_cache():
    """Wipe stale WebKit asset cache while keeping localStorage save data under ~/Library/WebKit/com.boneyard.game/WebsiteData."""
    cache_dir = os.path.expanduser("~/Library/Caches/com.boneyard.game")
    if os.path.exists(cache_dir):
        print(f"[*] Clearing stale WebKit asset cache: {cache_dir}")
        shutil.rmtree(cache_dir, ignore_errors=True)


def verify_embedded_js(app_path, expected_js_names):
    """Ensure the Mach-O binary embeds the current dist/assets/index-*.js bundle."""
    binary = os.path.join(app_path, "Contents/MacOS/boneyard")
    out = subprocess.check_output(["strings", binary], text=True, errors="ignore")
    found = sorted(set(re.findall(r"index-[A-Za-z0-9_-]+\.js", out)))
    if not expected_js_names:
        raise RuntimeError("No dist/assets/index-*.js found; run Vite/Tauri build first.")
    expected = expected_js_names[0]
    if expected not in found:
        raise RuntimeError(f"Bundle mismatch in {binary}: expected {expected}, found {found}")
    print(f"[✓] Verified embedded JS in {app_path}: {expected}")


def package_boneyard_mac_app(deploy_only=False):
    repo_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    entitlements_path = os.path.join(repo_dir, "src-tauri/Entitlements.plist")
    tauri_app_src = os.path.join(repo_dir, "src-tauri/target/release/bundle/macos/BONEYARD.app")

    env = os.environ.copy()
    env["PATH"] = f"{os.path.expanduser('~/.cargo/bin')}:/opt/homebrew/bin:/usr/local/bin:{env.get('PATH', '')}"

    # 1. Build (unless --deploy-only with an existing source bundle)
    if deploy_only:
        if not os.path.exists(tauri_app_src):
            raise FileNotFoundError(f"--deploy-only passed, but {tauri_app_src} does not exist")
        print(f"[1/4] --deploy-only: skipping rebuild, using {tauri_app_src}")
    else:
        print("[1/4] Building BONEYARD.app via Tauri...")
        subprocess.run(["npx", "tauri", "build", "--bundles", "app"], cwd=repo_dir, env=env, check=True)
        if not os.path.exists(tauri_app_src):
            raise FileNotFoundError(f"Tauri bundle not found at {tauri_app_src}")

    expected_js_names = [os.path.basename(p) for p in sorted(glob.glob(os.path.join(repo_dir, "dist/assets/index-*.js")))]

    # Terminate running instance and wipe stale WebKit cache (keeping WebsiteData save intact)
    subprocess.run(["pkill", "-x", "boneyard"], check=False)
    clear_webkit_cache()

    # 2. Sign the source bundle
    identity = get_signing_identity()
    print(f"[2/4] Signing source bundle (identity: {identity})...")
    sign_app(tauri_app_src, entitlements_path, identity)
    verify_embedded_js(tauri_app_src, expected_js_names)

    # 3. Replace deployed bundles cleanly (remove first so .app never nests inside .app)
    targets = [
        "/Applications/BONEYARD.app",
        os.path.expanduser("~/Desktop/BONEYARD.app"),
    ]
    print("[3/4] Replacing installed BONEYARD.app bundles cleanly...")
    for target_app in targets:
        target_dir = os.path.dirname(target_app)
        if not os.path.exists(target_dir):
            continue
        if os.path.exists(target_app):
            shutil.rmtree(target_app)
        shutil.copytree(tauri_app_src, target_app, symlinks=True)
        sign_app(target_app, entitlements_path, identity)
        clean_quarantine(target_app)
        refresh_launch_services(target_app)
        verify_embedded_js(target_app, expected_js_names)

    print("[4/4] BONEYARD.app packaged, verified, and deployed cleanly!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build, sign, and deploy BONEYARD.app for macOS.")
    parser.add_argument("--deploy-only", action="store_true", help="Skip Tauri rebuild and deploy existing BONEYARD.app.")
    args = parser.parse_args()
    package_boneyard_mac_app(deploy_only=args.deploy_only)
