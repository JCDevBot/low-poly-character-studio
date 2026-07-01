#!/usr/bin/env python3
import json
from pathlib import Path

DEFAULT_INPUT = Path("packages/style-engine/output/little_guy_style.json")

def main():
    if not DEFAULT_INPUT.exists():
        print(f"Missing {DEFAULT_INPUT}")
        print("Export little_guy_style.json from Style Studio and copy it here first.")
        raise SystemExit(1)

    data = json.loads(DEFAULT_INPUT.read_text())
    print(json.dumps(data.get("blenderHints", data), indent=2))

if __name__ == "__main__":
    main()
