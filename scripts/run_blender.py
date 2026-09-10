"""Use BLENDER_BIN, PATH, or Blender's Windows installation to run an asset step."""
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
candidates = [os.environ.get("BLENDER_BIN"), shutil.which("blender")]
if sys.platform == "win32":
    foundation = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Blender Foundation"
    candidates.extend(str(path) for path in sorted(foundation.glob("Blender */blender.exe"), reverse=True))
executable = next((item for item in candidates if item and Path(item).is_file()), None)
if not executable:
    raise SystemExit("Blender was not found. Set BLENDER_BIN to an installed Blender executable.")
if len(sys.argv) < 2 or sys.argv[1] not in ("build", "export"):
    raise SystemExit("Usage: python scripts/run_blender.py build|export [--poster]")
script = ROOT / "scripts" / f"{sys.argv[1]}_asset.py"
raise SystemExit(subprocess.call([executable, "--background", "--python", str(script), "--", *sys.argv[2:]], cwd=ROOT))
