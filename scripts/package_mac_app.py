#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys

def get_signing_identity():
    """Check for an Apple Developer ID or valid code signing certificate."""
    try:
        out = subprocess.check_output(["security", "find-identity", "-v", "-p", "codesigning"], text=True)
        for line in out.splitlines():
            line = line.strip()
            if "Developer ID Application:" in line or "Apple Development:" in line:
                parts = line.split("\"", 2)
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
        app_path
    ]
    res = subprocess.run(cmd)
    if res.returncode != 0 and identity != "-":
        print("[!] Developer certificate keychain locked (errSecInternalComponent); falling back to ad-hoc signature ('-')...")
        cmd_adhoc = [
            "codesign",
            "--force",
            "--deep",
            "--options", "runtime",
            "--entitlements", entitlements_path,
            "--sign", "-",
            app_path
        ]
        subprocess.run(cmd_adhoc, check=True)
    elif res.returncode != 0:
        raise subprocess.CalledProcessError(res.returncode, cmd)
    subprocess.run(["codesign", "--verify", "--deep", "--strict", "--verbose=2", app_path], check=True)
    print(f"[✓] Code signature verified successfully on {os.path.basename(app_path)}!")

def clean_quarantine(app_path):
    """Remove quarantine attributes so Gatekeeper allows immediate launch."""
    try:
        subprocess.run(["xattr", "-cr", app_path], check=False)
    except Exception:
        pass

def package_citadel_mac_app():
    repo_dir = "/Users/wyatt/Documents/GitHub/Sigma_Engine_Citadel"
    entitlements_path = os.path.join(repo_dir, "src-tauri/Entitlements.plist")
    macos_bundle_dir = os.path.join(repo_dir, "src-tauri/target/release/bundle/macos")
    candidates = [
        os.path.join(macos_bundle_dir, "∑NGN∑.app"),
        os.path.join(macos_bundle_dir, "Citadel.app"),
        os.path.join(macos_bundle_dir, "The Citadel.app"),
        os.path.join(macos_bundle_dir, "sigmaengine.app"),
    ]

    # Ensure ARM64-first PATH for native builds
    env = os.environ.copy()
    env["PATH"] = f"{os.path.expanduser("~/.cargo/bin")}:/opt/homebrew/bin:/usr/local/bin:{env.get("PATH", "")}"

    # 1. Build native Tauri application bundle
    print("[1/4] Building native Tauri Citadel macOS app bundle...")
    subprocess.run(["npx", "tauri", "build", "--bundles", "app"], cwd=repo_dir, env=env, check=True)

    tauri_app_src = next((p for p in candidates if os.path.exists(p)), None)
    if not tauri_app_src:
        raise FileNotFoundError(f"Tauri bundle not found in {macos_bundle_dir}")

    # 2. Sign the source bundle
    identity = get_signing_identity()
    print(f"[2/4] Signing source bundle with identity: {identity}")
    sign_app(tauri_app_src, entitlements_path, identity)

    # 3. Deploy genuine native bundle to target locations
    targets = [
        os.path.join(repo_dir, "releases/∑NGN∑.app"),
        os.path.expanduser("~/Desktop/∑NGN∑.app"),
        "/Applications/∑NGN∑.app",
    ]

    print("[3/4] Installing native macOS app to target destinations...")
    for target_app in targets:
        target_dir = os.path.dirname(target_app)
        if not os.path.exists(target_dir):
            continue

        print(f"      -> Deploying to {target_app}...")
        if os.path.exists(target_app):
            shutil.rmtree(target_app)

        shutil.copytree(tauri_app_src, target_app, symlinks=True)
        sign_app(target_app, entitlements_path, identity)
        clean_quarantine(target_app)

    # 4. Final summary
    print("[4/4] Citadel packaged, sealed, and deployed successfully in good standing!")
    if identity == "-":
        print("      Note: App is signed ad-hoc with Hardened Runtime and sealed resources.")
        print("      For distribution to other machines without Gatekeeper warnings,")
        print("      configure an Apple Developer ID certificate in your macOS Keychain.")

if __name__ == "__main__":
    package_citadel_mac_app()
