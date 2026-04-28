-- ============================================================
-- ADYPU Chat - MySQL Schema
-- Database name: adypu_chat
-- Import this file in phpMyAdmin to create all tables
-- ============================================================

CREATE DATABASE IF NOT EXISTS `adypu_chat` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `adypu_chat`;

-- ── Roles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `roles` (
  `id`         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(50)  NOT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `roles_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `username`      VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role_id`       INT          NOT NULL,
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `users_username_unique` (`username`),
  KEY `users_username_idx` (`username`),
  CONSTRAINT `users_role_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Sources ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sources` (
  `id`          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `domain`      VARCHAR(255) NOT NULL,
  `url_pattern` VARCHAR(500) NOT NULL,
  `seed_url`    VARCHAR(500),
  `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `sources_domain_idx` (`domain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Crawl Jobs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `crawl_jobs` (
  `id`                     INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `status`                 VARCHAR(50)  NOT NULL DEFAULT 'pending',
  `pages_found`            INT          NOT NULL DEFAULT 0,
  `total_pages_discovered` INT          NOT NULL DEFAULT 0,
  `pages_processed`        INT          NOT NULL DEFAULT 0,
  `pages_failed`           INT          NOT NULL DEFAULT 0,
  `triggered_by`           INT,
  `error_log`              TEXT,
  `started_at`             TIMESTAMP    NULL,
  `completed_at`           TIMESTAMP    NULL,
  `created_at`             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `crawl_jobs_status_idx` (`status`),
  CONSTRAINT `crawl_jobs_triggered_by_fk` FOREIGN KEY (`triggered_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Documents ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `documents` (
  `id`           INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `source_id`    INT           NOT NULL,
  `crawl_job_id` INT,
  `title`        TEXT          NOT NULL,
  `source_url`   VARCHAR(1000) NOT NULL,
  `content_type` VARCHAR(50)   NOT NULL DEFAULT 'html',
  `content_hash` VARCHAR(64)   NOT NULL,
  `raw_text`     LONGTEXT,
  `metadata`     JSON,
  `is_active`    TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `documents_source_id_idx` (`source_id`),
  KEY `documents_content_hash_idx` (`content_hash`),
  CONSTRAINT `documents_source_id_fk`    FOREIGN KEY (`source_id`)    REFERENCES `sources` (`id`),
  CONSTRAINT `documents_crawl_job_id_fk` FOREIGN KEY (`crawl_job_id`) REFERENCES `crawl_jobs` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Document Chunks ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `document_chunks` (
  `id`          INT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `document_id` INT        NOT NULL,
  `chunk_index` INT        NOT NULL,
  `title`       TEXT,
  `content`     LONGTEXT   NOT NULL,
  `embedding`   JSON,
  `token_count` INT,
  `created_at`  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `chunks_document_id_idx` (`document_id`),
  CONSTRAINT `chunks_document_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Document Entities ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `document_entities` (
  `id`           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `chunk_id`     INT          NOT NULL,
  `entity_type`  VARCHAR(100) NOT NULL,
  `entity_value` TEXT         NOT NULL,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `entities_chunk_id_idx` (`chunk_id`),
  KEY `entities_type_idx` (`entity_type`),
  CONSTRAINT `entities_chunk_id_fk` FOREIGN KEY (`chunk_id`) REFERENCES `document_chunks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Query Logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `query_logs` (
  `id`               INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id`          INT,
  `question`         TEXT         NOT NULL,
  `rewritten_query`  TEXT,
  `intent`           VARCHAR(100),
  `entities`         JSON,
  `confidence_score` INT          NOT NULL DEFAULT 0,
  `confidence_label` VARCHAR(20),
  `session_id`       VARCHAR(100),
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `query_logs_user_idx`       (`user_id`),
  KEY `query_logs_intent_idx`     (`intent`),
  KEY `query_logs_confidence_idx` (`confidence_score`),
  KEY `query_logs_created_idx`    (`created_at`),
  CONSTRAINT `query_logs_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Answer Logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `answer_logs` (
  `id`                    INT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `query_log_id`          INT        NOT NULL,
  `answer`                LONGTEXT   NOT NULL,
  `chunk_ids`             JSON,
  `retrieval_score`       INT        NOT NULL DEFAULT 0,
  `rerank_score`          INT        NOT NULL DEFAULT 0,
  `source_agreement_score` INT       NOT NULL DEFAULT 0,
  `freshness_score`       INT        NOT NULL DEFAULT 0,
  `answerability_score`   INT        NOT NULL DEFAULT 0,
  `created_at`            TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `answer_logs_query_log_id_fk` FOREIGN KEY (`query_log_id`) REFERENCES `query_logs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Feedback ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `feedback` (
  `id`           INT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `query_log_id` INT        NOT NULL,
  `rating`       INT        NOT NULL,
  `comment`      TEXT,
  `created_at`   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `feedback_query_log_idx` (`query_log_id`),
  CONSTRAINT `feedback_query_log_id_fk` FOREIGN KEY (`query_log_id`) REFERENCES `query_logs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Audit Logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT,
  `action`      VARCHAR(100) NOT NULL,
  `resource`    VARCHAR(100),
  `resource_id` INT,
  `details`     JSON,
  `ip_address`  VARCHAR(50),
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `audit_logs_user_idx`    (`user_id`),
  KEY `audit_logs_action_idx`  (`action`),
  KEY `audit_logs_created_idx` (`created_at`),
  CONSTRAINT `audit_logs_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Settings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `settings` (
  `id`         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `key`        VARCHAR(100) NOT NULL,
  `value`      TEXT         NOT NULL,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `settings_key_unique` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- All 12 tables created successfully.
-- The admin account (admin / adypu-admin-2024) and default
-- settings are seeded automatically when the server starts.
-- ============================================================
