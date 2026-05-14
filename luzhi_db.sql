-- ============================================================
-- 律智助手 · MySQL 数据库建库脚本
-- 数据库版本：MySQL 8.0+
-- 字符集：utf8mb4（支持中文及Emoji）
-- 创建时间：2026-03-26
-- ============================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS luzhi_assistant
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE luzhi_assistant;

-- ============================================================
-- 1. 用户表 users
-- 存储注册用户的基础信息
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          CHAR(36)        NOT NULL COMMENT '用户ID，UUID格式',
    nickname    VARCHAR(64)     NOT NULL DEFAULT '用户' COMMENT '昵称',
    phone       VARCHAR(20)     UNIQUE COMMENT '手机号（可为空）',
    user_type   VARCHAR(16)     NOT NULL DEFAULT 'personal'
                    COMMENT '用户类型：personal=个人 / merchant=个体工商户 / enterprise=小微企业',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',

    PRIMARY KEY (id),
    CONSTRAINT chk_users_type CHECK (user_type IN ('personal', 'merchant', 'enterprise'))
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='用户表';


-- ============================================================
-- 2. 对话会话表 chat_sessions
-- 每次打开一个对话窗口，生成一条会话记录
-- tool_type 记录本次会话用的是哪个工具入口
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id          CHAR(36)        NOT NULL COMMENT '会话ID，UUID格式',
    user_id     CHAR(36)        NOT NULL COMMENT '所属用户ID',
    title       VARCHAR(128)    NOT NULL DEFAULT '新对话' COMMENT '会话标题（取第一条消息前22字）',
    tool_type   VARCHAR(16)     NOT NULL DEFAULT 'chat'
                    COMMENT '工具类型：chat=自由对话 / law=法条检索 / case=案例检索 / contract=合同生成 / review=合同审查',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    PRIMARY KEY (id),
    CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_sessions_tool
        CHECK (tool_type IN ('chat', 'law', 'case', 'contract', 'review')),

    INDEX idx_sessions_user (user_id),
    INDEX idx_sessions_created (user_id, created_at DESC)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='对话会话表';


-- ============================================================
-- 3. 消息记录表 chat_messages
-- 存储每一轮对话的用户消息和AI回复
-- tool_badge 对应前端消息气泡顶部的彩色工具标签
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id          CHAR(36)        NOT NULL COMMENT '消息ID，UUID格式',
    session_id  CHAR(36)        NOT NULL COMMENT '所属会话ID',
    role        VARCHAR(16)     NOT NULL COMMENT '发送方：user=用户 / assistant=AI',
    content     MEDIUMTEXT      NOT NULL COMMENT '消息内容（AI回复可能较长，用MEDIUMTEXT）',
    tool_badge  VARCHAR(16)     DEFAULT NULL
                    COMMENT '工具标签（仅assistant消息）：law / case / contract / review / NULL',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',

    PRIMARY KEY (id),
    CONSTRAINT fk_messages_session
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    CONSTRAINT chk_messages_role
        CHECK (role IN ('user', 'assistant')),
    CONSTRAINT chk_messages_badge
        CHECK (tool_badge IN ('law', 'case', 'contract', 'review') OR tool_badge IS NULL),

    INDEX idx_messages_session (session_id, created_at ASC)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='消息记录表';


-- ============================================================
-- 4. 合同存档表 contracts
-- 合同生成和合同审查的结果单独存档，方便用户后续查阅和下载
-- 合同生成：填 content 字段
-- 合同审查：填 review_result、review_role、risk_level 字段
-- ============================================================
CREATE TABLE IF NOT EXISTS contracts (
    id              CHAR(36)        NOT NULL COMMENT '合同ID，UUID格式',
    user_id         CHAR(36)        NOT NULL COMMENT '所属用户ID',
    session_id      CHAR(36)        DEFAULT NULL COMMENT '关联的会话ID（可为空）',

    -- 合同基础信息
    title           VARCHAR(256)    NOT NULL COMMENT '合同标题（如：技术服务合同-2026）',
    contract_type   VARCHAR(32)     DEFAULT NULL
                        COMMENT '合同类型：劳动合同 / 采购合同 / 借贷合同 / 租赁合同 / 技术服务合同 / 其他',
    scene           VARCHAR(16)     NOT NULL DEFAULT 'generate'
                        COMMENT '来源场景：generate=AI生成 / review=审查上传',

    -- 合同生成字段
    content         MEDIUMTEXT      DEFAULT NULL COMMENT '合同全文（AI生成的草稿）',

    -- 合同审查字段
    review_result   MEDIUMTEXT      DEFAULT NULL COMMENT '审查报告全文（AI输出）',
    review_role     VARCHAR(16)     DEFAULT 'neutral'
                        COMMENT '审查视角：party_a=甲方 / party_b=乙方 / neutral=中立',
    risk_level      VARCHAR(8)      DEFAULT NULL
                        COMMENT '整体风险等级：high=高风险 / medium=中等风险 / low=低风险',

    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',

    PRIMARY KEY (id),
    CONSTRAINT fk_contracts_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_contracts_session
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL,
    CONSTRAINT chk_contracts_scene
        CHECK (scene IN ('generate', 'review')),
    CONSTRAINT chk_contracts_role
        CHECK (review_role IN ('party_a', 'party_b', 'neutral')),
    CONSTRAINT chk_contracts_risk
        CHECK (risk_level IN ('high', 'medium', 'low') OR risk_level IS NULL),

    INDEX idx_contracts_user (user_id),
    INDEX idx_contracts_scene (user_id, scene),
    INDEX idx_contracts_created (user_id, created_at DESC)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='合同存档表';


-- ============================================================
-- 5. 文件上传记录表 uploaded_files
-- 合同审查时用户上传的 PDF/Word 原始文件记录
-- 实际文件存储在腾讯云COS或本地，这里只存元数据和路径
-- ============================================================
CREATE TABLE IF NOT EXISTS uploaded_files (
    id              CHAR(36)        NOT NULL COMMENT '文件ID，UUID格式',
    user_id         CHAR(36)        NOT NULL COMMENT '上传用户ID',
    contract_id     CHAR(36)        DEFAULT NULL COMMENT '关联合同ID（审查完成后关联）',

    file_name       VARCHAR(256)    NOT NULL COMMENT '原始文件名（如：采购合同-供应商A.pdf）',
    file_size       INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '文件大小（字节）',
    file_type       VARCHAR(16)     NOT NULL DEFAULT 'pdf'
                        COMMENT '文件类型：pdf / docx',
    storage_url     VARCHAR(512)    DEFAULT NULL COMMENT '存储路径（COS对象Key或本地路径）',

    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',

    PRIMARY KEY (id),
    CONSTRAINT fk_files_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_files_contract
        FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL,
    CONSTRAINT chk_files_type
        CHECK (file_type IN ('pdf', 'docx')),

    INDEX idx_files_user (user_id),
    INDEX idx_files_contract (contract_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='文件上传记录表';


-- ============================================================
-- 触发器：自动生成 UUID（MySQL 8.0 支持 UUID() 函数）
-- 说明：如果后端（Node.js）在应用层生成 UUID 传入，则不需要这些触发器
--       如果希望数据库自动填充，则启用以下触发器
-- ============================================================

DELIMITER $$

CREATE TRIGGER trg_users_uuid
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
    IF NEW.id IS NULL OR NEW.id = '' THEN
        SET NEW.id = UUID();
    END IF;
END$$

CREATE TRIGGER trg_sessions_uuid
BEFORE INSERT ON chat_sessions
FOR EACH ROW
BEGIN
    IF NEW.id IS NULL OR NEW.id = '' THEN
        SET NEW.id = UUID();
    END IF;
END$$

CREATE TRIGGER trg_messages_uuid
BEFORE INSERT ON chat_messages
FOR EACH ROW
BEGIN
    IF NEW.id IS NULL OR NEW.id = '' THEN
        SET NEW.id = UUID();
    END IF;
END$$

CREATE TRIGGER trg_contracts_uuid
BEFORE INSERT ON contracts
FOR EACH ROW
BEGIN
    IF NEW.id IS NULL OR NEW.id = '' THEN
        SET NEW.id = UUID();
    END IF;
END$$

CREATE TRIGGER trg_files_uuid
BEFORE INSERT ON uploaded_files
FOR EACH ROW
BEGIN
    IF NEW.id IS NULL OR NEW.id = '' THEN
        SET NEW.id = UUID();
    END IF;
END$$

DELIMITER ;


-- ============================================================
-- 初始化测试数据
-- ============================================================

-- 插入一个测试用户
INSERT INTO users (id, nickname, phone, user_type)
VALUES ('00000000-0000-0000-0000-000000000001', '测试用户', '13800000000', 'personal');

-- 插入一条测试会话
INSERT INTO chat_sessions (id, user_id, title, tool_type)
VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '劳动合同试用期咨询', 'law');

-- 插入两条测试消息
INSERT INTO chat_messages (id, session_id, role, content, tool_badge)
VALUES
    ('00000000-0000-0000-0000-000000000100',
     '00000000-0000-0000-0000-000000000010',
     'user',
     '劳动合同试用期最长多久？',
     NULL),
    ('00000000-0000-0000-0000-000000000101',
     '00000000-0000-0000-0000-000000000010',
     'assistant',
     '根据《劳动合同法》第十九条，试用期最长不得超过6个月（适用于3年以上或无固定期限合同）。',
     'law');
