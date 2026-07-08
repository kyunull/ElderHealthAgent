import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'yinian.db');

let db;

export function getDb() {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

export function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT DEFAULT 'patient',
      height_cm REAL,
      weight_kg REAL,
      birth_date TEXT,
      gender TEXT,
      blood_type TEXT,
      api_key_encrypted TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS allergies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      allergen TEXT NOT NULL,
      severity TEXT DEFAULT 'mild',
      reaction TEXT,
      recorded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS health_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      report_type TEXT NOT NULL CHECK(report_type IN ('biochemical','imaging')),
      title TEXT NOT NULL,
      report_date TEXT NOT NULL,
      hospital_name TEXT,
      department TEXT,
      original_image_path TEXT,
      raw_text TEXT,
      ai_processed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'uploaded',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS biochemical_indicators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES health_reports(id) ON DELETE CASCADE,
      indicator_name TEXT NOT NULL,
      indicator_code TEXT,
      value REAL NOT NULL,
      unit TEXT,
      reference_range_low REAL,
      reference_range_high REAL,
      reference_range_text TEXT,
      is_abnormal INTEGER DEFAULT 0,
      abnormality_direction TEXT
    );

    CREATE TABLE IF NOT EXISTS imaging_findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES health_reports(id) ON DELETE CASCADE,
      body_part TEXT NOT NULL,
      modality TEXT NOT NULL,
      finding TEXT NOT NULL,
      impression TEXT
    );

    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      drug_name TEXT NOT NULL,
      generic_name TEXT,
      dosage TEXT NOT NULL,
      dosage_unit TEXT,
      frequency TEXT NOT NULL,
      route TEXT DEFAULT 'oral',
      start_date TEXT NOT NULL,
      end_date TEXT,
      timing TEXT DEFAULT 'any',
      schedule_times TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS drug_interaction_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      drug_pair TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('A','B','C','D','X')),
      mechanism TEXT,
      management TEXT,
      medication_ids TEXT,
      checked_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS drug_interactions_db (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drug_a TEXT NOT NULL,
      drug_b TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('A','B','C','D','X')),
      mechanism TEXT,
      management TEXT
    );

    CREATE TABLE IF NOT EXISTS specialist_consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      consultation_type TEXT NOT NULL CHECK(consultation_type IN ('single_specialist','mdt')),
      specialty TEXT,
      chief_complaint TEXT NOT NULL,
      related_report_ids TEXT,
      ai_response TEXT,
      mdt_specialties TEXT,
      mdt_summary TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS health_trends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      indicator_code TEXT NOT NULL,
      period TEXT NOT NULL,
      data_points TEXT NOT NULL,
      trend_direction TEXT,
      min_value REAL,
      max_value REAL,
      avg_value REAL,
      generated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cga_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      assessment_date TEXT NOT NULL,
      adl_score INTEGER,
      adl_level TEXT,
      adl_data TEXT,
      iadl_score INTEGER,
      iadl_data TEXT,
      frailty_score INTEGER,
      frailty_data TEXT,
      nutrition_score INTEGER,
      nutrition_data TEXT,
      cognitive_score INTEGER,
      cognitive_quick_data TEXT,
      depression_score INTEGER,
      depression_data TEXT,
      fall_risk_score INTEGER,
      fall_risk_data TEXT,
      comorbidity_count INTEGER,
      polypharmacy_flag INTEGER DEFAULT 0,
      social_support TEXT,
      living_arrangement TEXT,
      social_data TEXT,
      overall_summary TEXT,
      recommendations TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cognitive_screenings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      cga_assessment_id INTEGER REFERENCES cga_assessments(id),
      screening_date TEXT NOT NULL,
      screening_type TEXT NOT NULL,
      total_score REAL,
      score_max REAL,
      score_interpretation TEXT,
      subsection_scores TEXT,
      education_adjusted INTEGER DEFAULT 0,
      education_years INTEGER,
      informant_available INTEGER DEFAULT 0,
      informant_responses TEXT,
      cdr_global_score REAL,
      cdr_domains TEXT,
      symptoms_duration_months INTEGER,
      daily_function_impact TEXT,
      ai_analysis TEXT,
      risk_level TEXT,
      follow_up_recommendation TEXT,
      status TEXT DEFAULT 'draft',
      previous_screening_id INTEGER REFERENCES cognitive_screenings(id),
      score_change REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT UNIQUE NOT NULL,
      config_value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS medication_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      medication_id INTEGER REFERENCES medications(id),
      reminder_type TEXT NOT NULL CHECK(reminder_type IN ('sms','phone','app')),
      phone_number TEXT,
      remind_time TEXT NOT NULL,
      days_of_week TEXT DEFAULT '1,2,3,4,5,6,7',
      enabled INTEGER DEFAULT 1,
      last_sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrations for existing databases
  try { db.exec('ALTER TABLE medications ADD COLUMN timing TEXT DEFAULT \'any\''); } catch {}
  try { db.exec('ALTER TABLE medications ADD COLUMN schedule_times TEXT'); } catch {}
  try { db.exec('ALTER TABLE medications ADD COLUMN spec_per_pill_mg REAL'); } catch {}
  try { db.exec('ALTER TABLE cga_assessments ADD COLUMN cognitive_quick_data TEXT'); } catch {}
  try { db.exec('ALTER TABLE cga_assessments ADD COLUMN social_data TEXT'); } catch {}

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reports_user_date ON health_reports(user_id, report_date DESC);
    CREATE INDEX IF NOT EXISTS idx_indicators_report ON biochemical_indicators(report_id);
    CREATE INDEX IF NOT EXISTS idx_indicators_code ON biochemical_indicators(indicator_code);
    CREATE INDEX IF NOT EXISTS idx_medications_user_status ON medications(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_consultations_user ON specialist_consultations(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cga_user ON cga_assessments(user_id, assessment_date DESC);
    CREATE INDEX IF NOT EXISTS idx_screening_user_type ON cognitive_screenings(user_id, screening_type);
  `);

  console.log('[DB] Database initialized successfully');
}
