"""AgentOps Orchestrator — main entry point for the autonomous MLOps platform.

Three execution modes:
  demo        Run the full pipeline once with a pre-seeded drift scenario.
  monitor     Polling loop that checks every N seconds.
  investigate On-demand investigation of a user-provided issue.

Usage:
  python src/orchestrator.py --mode demo
  python src/orchestrator.py --mode monitor --interval 30
  python src/orchestrator.py --mode investigate --query "Model F1 dropped to 0.82"
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Ensure src/ is on the path
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from config import settings  # noqa: E402
from crew.crew import AgentOpsCrew  # noqa: E402

LOGS_DIR = Path(__file__).parent.parent / "logs"


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _save_log(run_id: str, data: dict) -> Path:
    LOGS_DIR.mkdir(exist_ok=True)
    path = LOGS_DIR / f"run_{run_id}.json"
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    return path


def run_demo():
    """Mode 1: Run the full pipeline once with the pre-seeded drift scenario."""
    print("=" * 60)
    print("  AgentOps — Demo Mode")
    print("=" * 60)
    print()

    crew = AgentOpsCrew()
    run_id = _ts()

    t_start = time.time()
    print("[1/3] Monitor Agent checking system health...")
    print()

    result = crew.run(context="Check for model drift — the demo scenario has elevated drift on V14 and V17.")

    t_end = time.time()
    elapsed = t_end - t_start

    log_data = {
        "run_id": run_id,
        "mode": "demo",
        "started_at": datetime.fromtimestamp(t_start, tz=timezone.utc).isoformat(),
        "ended_at": datetime.fromtimestamp(t_end, tz=timezone.utc).isoformat(),
        "elapsed_sec": round(elapsed, 2),
        "result": result,
    }
    log_path = _save_log(run_id, log_data)

    print()
    print("=" * 60)
    print("  Demo Complete")
    print(f"  Elapsed: {elapsed:.1f}s")
    print(f"  Log: {log_path}")
    print("=" * 60)
    print()
    print("Result:")
    print(result)


def run_monitor(interval: int):
    """Mode 2: Polling loop — monitor, and escalate if alert detected."""
    print("=" * 60)
    print(f"  AgentOps — Monitor Mode (interval={interval}s)")
    print("  Press Ctrl+C to stop")
    print("=" * 60)
    print()

    crew = AgentOpsCrew()
    cycle = 0

    try:
        while True:
            cycle += 1
            run_id = _ts()
            t_start = time.time()
            print(f"[Cycle {cycle}] Monitoring at {datetime.now(timezone.utc).isoformat()}...")

            monitor_result = crew.run_monitor_only(context="Routine health check")

            is_healthy = "ALL_HEALTHY" in monitor_result.upper()

            if is_healthy:
                print(f"[Cycle {cycle}] All healthy. Next check in {interval}s.")
                log_data = {
                    "run_id": run_id,
                    "mode": "monitor",
                    "cycle": cycle,
                    "status": "healthy",
                    "result": monitor_result,
                    "elapsed_sec": round(time.time() - t_start, 2),
                }
                _save_log(run_id, log_data)
            else:
                print(f"[Cycle {cycle}] Alert detected! Running full pipeline...")
                full_result = crew.run(
                    context=f"Alert from monitoring cycle {cycle}: {monitor_result}"
                )
                log_data = {
                    "run_id": run_id,
                    "mode": "monitor_escalated",
                    "cycle": cycle,
                    "status": "escalated",
                    "monitor_result": monitor_result,
                    "full_result": full_result,
                    "elapsed_sec": round(time.time() - t_start, 2),
                }
                _save_log(run_id, log_data)
                print(f"[Cycle {cycle}] Resolution complete. Resuming monitoring.")

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\nMonitor stopped by user.")


def run_investigate(query: str):
    """Mode 3: On-demand investigation of a user-provided issue."""
    print("=" * 60)
    print("  AgentOps — Investigation Mode")
    print(f"  Query: {query}")
    print("=" * 60)
    print()

    crew = AgentOpsCrew()
    run_id = _ts()
    t_start = time.time()

    result = crew.run(context=f"User-reported issue: {query}")

    t_end = time.time()
    elapsed = t_end - t_start

    log_data = {
        "run_id": run_id,
        "mode": "investigate",
        "query": query,
        "started_at": datetime.fromtimestamp(t_start, tz=timezone.utc).isoformat(),
        "ended_at": datetime.fromtimestamp(t_end, tz=timezone.utc).isoformat(),
        "elapsed_sec": round(elapsed, 2),
        "result": result,
    }
    log_path = _save_log(run_id, log_data)

    print()
    print("=" * 60)
    print("  Investigation Complete")
    print(f"  Elapsed: {elapsed:.1f}s")
    print(f"  Log: {log_path}")
    print("=" * 60)
    print()
    print("Result:")
    print(result)


def main():
    parser = argparse.ArgumentParser(description="AgentOps Orchestrator")
    parser.add_argument(
        "--mode",
        choices=["demo", "monitor", "investigate"],
        default="demo",
        help="Execution mode (default: demo)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=settings.monitor_poll_interval_sec,
        help=f"Polling interval in seconds for monitor mode (default: {settings.monitor_poll_interval_sec})",
    )
    parser.add_argument(
        "--query",
        type=str,
        default="",
        help="Issue description for investigate mode",
    )
    args = parser.parse_args()

    if args.mode == "demo":
        run_demo()
    elif args.mode == "monitor":
        run_monitor(args.interval)
    elif args.mode == "investigate":
        if not args.query:
            parser.error("--query is required for investigate mode")
        run_investigate(args.query)


if __name__ == "__main__":
    main()
