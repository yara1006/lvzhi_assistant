"""解析元器/OpenAI 风格 SSE，拼接助手文本（用于流式结束后落库）。"""

from __future__ import annotations

import json


class SSEAssistantTextAccumulator:
    def __init__(self) -> None:
        self._line_buf = ""
        self._parts: list[str] = []

    def feed(self, chunk: bytes) -> None:
        self._line_buf += chunk.decode("utf-8", errors="replace")
        while True:
            idx = self._line_buf.find("\n")
            if idx < 0:
                break
            line = self._line_buf[:idx].strip()
            self._line_buf = self._line_buf[idx + 1 :]
            self._consume_line(line)

    def _consume_line(self, line: str) -> None:
        if not line.startswith("data:"):
            return
        data = line[5:].strip()
        if not data or data == "[DONE]":
            return
        try:
            obj = json.loads(data)
        except json.JSONDecodeError:
            return
        for choice in obj.get("choices") or []:
            delta = choice.get("delta") or {}
            c = delta.get("content")
            if isinstance(c, str) and c:
                self._parts.append(c)
            msg = choice.get("message") or {}
            c2 = msg.get("content")
            if isinstance(c2, str) and c2:
                self._parts.append(c2)

    def get_text(self) -> str:
        return "".join(self._parts)
