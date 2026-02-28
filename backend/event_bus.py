"""Thread-safe event bus for streaming crew execution events via SSE."""

import queue
import threading
from dataclasses import dataclass, field
from datetime import datetime, UTC
from typing import Optional


@dataclass
class CrewEvent:
    event_type: str  # stdout, agent_start, tool_call, task_complete, reasoning, complete, error, crew_start
    data: str
    timestamp: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    agent: Optional[str] = None


class EventBus:
    def __init__(self):
        self._subscribers: list[queue.Queue] = []
        self._lock = threading.Lock()
        self._history: list[CrewEvent] = []

    def subscribe(self) -> queue.Queue:
        q: queue.Queue[CrewEvent] = queue.Queue()
        with self._lock:
            for event in self._history:
                q.put(event)
            self._subscribers.append(q)
        return q

    def unsubscribe(self, q: queue.Queue):
        with self._lock:
            try:
                self._subscribers.remove(q)
            except ValueError:
                pass

    def publish(self, event: CrewEvent):
        with self._lock:
            self._history.append(event)
            for q in self._subscribers:
                try:
                    q.put_nowait(event)
                except queue.Full:
                    pass

    def clear_history(self):
        with self._lock:
            self._history.clear()


event_bus = EventBus()
