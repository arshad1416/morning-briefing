#!/usr/bin/env python3
"""
setup_env.py
Interactive script to securely save the Unusual Whales API Token (UNUSUAL_WHALES_API_KEY)
and Tiingo API Key (TIINGO_API_KEY) to the user's Hermes .env files.
"""

import os
import sys
import getpass
from pathlib import Path

def get_existing_key(env_paths, key_name):
    for env_path in env_paths:
        if env_path.is_file():
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        stripped = line.strip()
                        if stripped.startswith(f"{key_name}="):
                            parts = stripped.split("=", 1)
                            if len(parts) == 2:
                                val = parts[1].strip()
                                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                                    val = val[1:-1]
                                return val
            except Exception:
                pass
    return None

def setup_env():
    print("=" * 60)
    print("      MapleGamma market-data API key configuration")
    print("=" * 60)
    print("This script will securely prompt you for your API keys")
    print("and configure them in your Hermes environment files.")
    print("-" * 60)

    home = Path.home()
    env_paths = [
        home / ".hermes" / ".env",
        home / ".hermes" / "profiles" / "swe" / ".env"
    ]

    # Find existing keys if any
    existing_uw = get_existing_key(env_paths, "UNUSUAL_WHALES_API_KEY")
    existing_tiingo = get_existing_key(env_paths, "TIINGO_API_KEY")

    # 1. Prompt securely for Unusual Whales API Key
    try:
        if existing_uw:
            masked = existing_uw[:4] + "..." + existing_uw[-4:] if len(existing_uw) > 8 else "****"
            prompt_str = f"Enter Unusual Whales API Key (press Enter to keep existing [{masked}]): "
            uw_key = getpass.getpass(prompt_str).strip()
            if not uw_key:
                uw_key = existing_uw
        else:
            uw_key = getpass.getpass("Enter your Unusual Whales API Key: ").strip()
    except (KeyboardInterrupt, EOFError):
        print("\n\nSetup cancelled.")
        sys.exit(1)

    # 2. Prompt securely for Tiingo API Key
    try:
        if existing_tiingo:
            masked = existing_tiingo[:4] + "..." + existing_tiingo[-4:] if len(existing_tiingo) > 8 else "****"
            prompt_str = f"Enter Tiingo API Key (press Enter to keep existing [{masked}]): "
            tiingo_key = getpass.getpass(prompt_str).strip()
            if not tiingo_key:
                tiingo_key = existing_tiingo
        else:
            tiingo_key = getpass.getpass("Enter your Tiingo API Key: ").strip()
    except (KeyboardInterrupt, EOFError):
        print("\n\nSetup cancelled.")
        sys.exit(1)

    if not uw_key:
        print("Error: Unusual Whales API Key cannot be empty.")
        sys.exit(1)
    if not tiingo_key:
        print("Error: Tiingo API Key cannot be empty.")
        sys.exit(1)

    updated_files = []

    for env_path in env_paths:
        # Create parent directories if they don't exist
        env_path.parent.mkdir(parents=True, exist_ok=True)

        # Read existing file or create an empty list of lines
        lines = []
        file_exists = env_path.is_file()
        if file_exists:
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()
            except Exception as e:
                print(f"Warning: Could not read {env_path} due to: {e}")
                continue

        # Helper to update or append keys
        def update_key_in_lines(lines_list, key, val):
            found = False
            new_line = f'{key}="{val}"\n'
            for idx, l in enumerate(lines_list):
                if l.strip().startswith(f"{key}="):
                    lines_list[idx] = new_line
                    found = True
                    break
            if not found:
                if lines_list and not lines_list[-1].endswith("\n"):
                    lines_list[-1] += "\n"
                lines_list.append(new_line)
            return found

        uw_found = update_key_in_lines(lines, "UNUSUAL_WHALES_API_KEY", uw_key)
        tiingo_found = update_key_in_lines(lines, "TIINGO_API_KEY", tiingo_key)

        # Write/Update the file
        try:
            with open(env_path, "w", encoding="utf-8") as f:
                f.writelines(lines)

            # Ensure safe permissions (read/write only by owner, chmod 600)
            try:
                os.chmod(env_path, 0o600)
            except Exception:
                pass

            updated_files.append(env_path)
        except Exception as e:
            print(f"Error: Failed to write to {env_path}: {e}")

    # Success output
    if updated_files:
        print("\n" + "=" * 60)
        print("🎉 SUCCESS: Unusual Whales and Tiingo API Keys have been saved!")
        print("=" * 60)
        for path in updated_files:
            print(f" - [Saved/Updated] {path}")
        print("-" * 60)
        print("To load the new environment variables, restart your terminal or run:")
        print("  source ~/.hermes/.env")
        print("=" * 60 + "\n")
    else:
        print("\n❌ Setup failed: No files were updated.")
        sys.exit(1)

if __name__ == "__main__":
    setup_env()
