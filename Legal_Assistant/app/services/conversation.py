from typing import Any

from app.schemas.common import ChatMessage, MessagePart


def to_yuanqi_messages(messages: list[ChatMessage]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for m in messages:
        if isinstance(m.content, str):
            content_blocks: list[dict[str, Any]] = [{"type": "text", "text": m.content}]
        else:
            content_blocks = []
            for part in m.content:
                if part.type == "text" and part.text is not None:
                    content_blocks.append({"type": "text", "text": part.text})
                elif part.type == "image_url" and part.image_url is not None:
                    content_blocks.append({"type": "image_url", "image_url": part.image_url})
        if not content_blocks:
            raise ValueError("每条消息至少包含一段有效内容")
        out.append({"role": m.role, "content": content_blocks})
    return out


def build_user_message(text: str) -> list[dict[str, Any]]:
    return [{"role": "user", "content": [{"type": "text", "text": text}]}]


def merge_custom_variables(
    base: dict[str, str] | None, extra: dict[str, str] | None
) -> dict[str, str] | None:
    if not base and not extra:
        return None
    merged: dict[str, str] = {}
    if base:
        merged.update(base)
    if extra:
        merged.update(extra)
    return merged
