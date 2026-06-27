-- LandcareLink Catchment Mapping Platform — MySQL 8 schema (system of record)
-- Charset/collation chosen for full Unicode incl. macrons (Te Reo Māori).
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS landcarelink
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE landcarelink;

-- ── Groups ─────────────────────────────────────────────────────────────────
CREATE TABLE `groups` (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  type            ENUM('catchment','community','environmental') NOT NULL,
  region          VARCHAR(120) NOT NULL,
  status          ENUM('active','forming','dormant') NOT NULL DEFAULT 'active',
  description     TEXT         NULL,
  website         VARCHAR(512) NULL,
  lat             DECIMAL(9,6) NULL,
  lng             DECIMAL(9,6) NULL,
  -- PII + privacy flags (Module 13)
  contact_email   VARCHAR(255) NULL,
  contact_phone   VARCHAR(64)  NULL,
  publish_contact TINYINT(1)   NOT NULL DEFAULT 0,
  publish_email   TINYINT(1)   NOT NULL DEFAULT 0,
  publish_phone   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_groups_region (region),
  INDEX idx_groups_type (type),
  INDEX idx_groups_status (status),
  FULLTEXT idx_groups_search (name, description)
) ENGINE=InnoDB;

CREATE TABLE group_focus_areas (
  group_id   CHAR(36)    NOT NULL,
  focus_area VARCHAR(80) NOT NULL,
  PRIMARY KEY (group_id, focus_area),
  CONSTRAINT fk_focus_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
) ENGINE=InnoDB;
