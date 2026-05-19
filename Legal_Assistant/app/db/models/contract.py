from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Contract(Base):
    """contracts 表：合同生成与审查存档。"""

    __tablename__ = "contracts"
    __table_args__ = (
        CheckConstraint("scene IN ('generate', 'review')", name="chk_contracts_scene"),
        CheckConstraint(
            "review_role IN ('party_a', 'party_b', 'neutral')",
            name="chk_contracts_role",
        ),
        CheckConstraint(
            "(risk_level IN ('high', 'medium', 'low')) OR (risk_level IS NULL)",
            name="chk_contracts_risk",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("chat_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(String(256), nullable=False)
    contract_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    scene: Mapped[str] = mapped_column(String(16), nullable=False, default="generate")

    content: Mapped[str | None] = mapped_column(
        Text().with_variant(MEDIUMTEXT(), "mysql"),
        nullable=True,
    )
    review_result: Mapped[str | None] = mapped_column(
        Text().with_variant(MEDIUMTEXT(), "mysql"),
        nullable=True,
    )
    review_role: Mapped[str] = mapped_column(String(16), nullable=False, default="neutral")
    risk_level: Mapped[str | None] = mapped_column(String(8), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped["User"] = relationship("User", back_populates="contracts")
    session: Mapped["ChatSession | None"] = relationship(
        "ChatSession",
        back_populates="contracts",
    )
    uploaded_files: Mapped[list["UploadedFile"]] = relationship(
        "UploadedFile",
        back_populates="contract",
    )
