"""Capture sys.stdout and tee lines to the EventBus with classification."""

import io

from backend.event_bus import event_bus, CrewEvent

_AGENT_NAMES = [
    "ML Model Monitor",
    "ML Incident Investigator",
    "ML Operations Remediator",
]


class StdoutCapture(io.TextIOBase):
    """Tee: writes go to both the original stdout AND the event bus."""

    def __init__(self, original_stdout):
        self._original = original_stdout
        self._buffer = ""

    def write(self, text):
        self._original.write(text)
        self._original.flush()

        self._buffer += text
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            stripped = line.strip()
            if not stripped:
                continue
            event_bus.publish(CrewEvent(
                event_type=self._classify(stripped),
                data=line,
                agent=self._extract_agent(stripped),
            ))
        return len(text)

    def flush(self):
        self._original.flush()

    def writable(self):
        return True

    # ------------------------------------------------------------------

    @staticmethod
    def _classify(line: str) -> str:
        low = line.lower()
        if "working agent:" in low or "assigned agent:" in low:
            return "agent_start"
        if "using tool:" in low or "tool name:" in low or "tool:" in low:
            return "tool_call"
        if "task output" in low or "task completed" in low or "finished" in low:
            return "task_complete"
        if "thought:" in low or "thinking" in low:
            return "reasoning"
        if "traceback" in low or "raise " in low or "exception" in low:
            return "error"
        return "stdout"

    @staticmethod
    def _extract_agent(line: str) -> str | None:
        low = line.lower()
        for name in _AGENT_NAMES:
            if name.lower() in low:
                return name
        return None
