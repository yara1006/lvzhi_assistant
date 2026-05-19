from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    """users 表：与队友 DDL 一致（UUID 主键）。"""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "user_type IN ('personal', 'merchant', 'enterprise')",
            name="chk_users_type",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    nickname: Mapped[str] = mapped_column(String(64), nullable=False, default="用户")
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    user_type: Mapped[str] = mapped_column(String(16), nullable=False, default="personal")
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        "ChatSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    contracts: Mapped[list["Contract"]] = relationship(
        "Contract",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    uploaded_files: Mapped[list["UploadedFile"]] = relationship(
        "UploadedFile",
        back_populates="user",
        cascade="all, delete-orphan",
    )
