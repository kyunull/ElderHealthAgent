import bcrypt from 'bcrypt';
import { initDatabase, getDb } from './database.js';

const db = getDb();
initDatabase();

// Find or create the first user
let user = db.prepare('SELECT id FROM users LIMIT 1').get();
if (!user) {
  const password_hash = bcrypt.hashSync('123456', 12);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)'
  ).run('admin', password_hash, '管理员');
  user = { id: result.lastInsertRowid };
  console.log('Created default user: admin / 123456');
}

const userId = process.argv[2] ? parseInt(process.argv[2]) : user.id;
console.log(`Seeding data for user ${userId}...`);

// ── Medications (5 common elderly medications) ──
const existingMeds = db.prepare('SELECT COUNT(*) as cnt FROM medications WHERE user_id = ?').get(userId);
if (existingMeds.cnt === 0) {
  const insertMed = db.prepare(
    `INSERT INTO medications (user_id, drug_name, generic_name, dosage, dosage_unit, frequency, route, start_date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertMed.run(userId, '阿托伐他汀钙片', 'Atorvastatin', '20', 'mg', 'qd', 'oral', '2026-01-15', 'active', '降脂治疗，睡前服用');
  insertMed.run(userId, '二甲双胍缓释片', 'Metformin', '500', 'mg', 'bid', 'oral', '2026-01-15', 'active', '餐后服用，注意胃肠道反应');
  insertMed.run(userId, '苯磺酸氨氯地平片', 'Amlodipine', '5', 'mg', 'qd', 'oral', '2026-02-01', 'active', '降压治疗，清晨服用');
  insertMed.run(userId, '阿司匹林肠溶片', 'Aspirin', '100', 'mg', 'qd', 'oral', '2026-01-15', 'active', '抗血小板聚集，餐后服用');
  insertMed.run(userId, '奥美拉唑肠溶胶囊', 'Omeprazole', '20', 'mg', 'qd', 'oral', '2026-03-10', 'active', '胃黏膜保护');
  console.log('  Medications: 5 records inserted');
} else {
  console.log('  Medications: already exists, skipping');
}

// ── Drug interactions DB entries ──
const existingInteractions = db.prepare('SELECT COUNT(*) as cnt FROM drug_interactions_db').get();
if (existingInteractions.cnt === 0) {
  const insertDI = db.prepare(
    `INSERT INTO drug_interactions_db (drug_a, drug_b, severity, mechanism, management) VALUES (?, ?, ?, ?, ?)`
  );
  insertDI.run('阿司匹林肠溶片', '二甲双胍缓释片', 'B', '阿司匹林可能增强二甲双胍的降糖作用', '监测血糖，必要时调整二甲双胍剂量');
  insertDI.run('阿托伐他汀钙片', '苯磺酸氨氯地平片', 'C', '氨氯地平可能轻度增加他汀类药物血药浓度', '监测肝功能及肌酸激酶，避免大剂量他汀');
  insertDI.run('阿司匹林肠溶片', '奥美拉唑肠溶胶囊', 'C', '奥美拉唑可能降低阿司匹林的抗血小板作用', '考虑间隔服用或更换为H2受体拮抗剂');
  console.log('  Drug interactions DB: 3 records inserted');
} else {
  console.log('  Drug interactions DB: already exists, skipping');
}

// ── Health Reports with indicators (for trend data) ──
const existingReports = db.prepare('SELECT COUNT(*) as cnt FROM health_reports WHERE user_id = ?').get(userId);
if (existingReports.cnt === 0) {
  const insertReport = db.prepare(
    `INSERT INTO health_reports (user_id, report_type, title, report_date, hospital_name, department, status, ai_processed)
     VALUES (?, ?, ?, ?, ?, ?, 'confirmed', 1)`
  );
  const insertInd = db.prepare(
    `INSERT INTO biochemical_indicators (report_id, indicator_name, indicator_code, value, unit, reference_range_low, reference_range_high, is_abnormal, abnormality_direction)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // Report 1: 2026-01-15
  const r1 = insertReport.run(userId, 'biochemical', '生化全项检查', '2026-01-15', '北京协和医院', '检验科');
  insertInd.run(r1.lastInsertRowid, '空腹血糖', 'GLU', 6.8, 'mmol/L', 3.9, 6.1, 1, 'high');
  insertInd.run(r1.lastInsertRowid, '糖化血红蛋白', 'HbA1c', 7.2, '%', 4.0, 6.0, 1, 'high');
  insertInd.run(r1.lastInsertRowid, '总胆固醇', 'TC', 5.8, 'mmol/L', 2.8, 5.2, 1, 'high');
  insertInd.run(r1.lastInsertRowid, '甘油三酯', 'TG', 2.1, 'mmol/L', 0.56, 1.70, 1, 'high');
  insertInd.run(r1.lastInsertRowid, '低密度脂蛋白', 'LDL', 3.6, 'mmol/L', 0, 3.4, 1, 'high');
  insertInd.run(r1.lastInsertRowid, '谷丙转氨酶', 'ALT', 32, 'U/L', 0, 40, 0, null);
  insertInd.run(r1.lastInsertRowid, '肌酐', 'CREA', 88, 'μmol/L', 44, 133, 0, null);
  insertInd.run(r1.lastInsertRowid, '白细胞', 'WBC', 6.5, '×10^9/L', 3.5, 9.5, 0, null);

  // Report 2: 2026-03-20
  const r2 = insertReport.run(userId, 'biochemical', '复查生化全项', '2026-03-20', '北京协和医院', '检验科');
  insertInd.run(r2.lastInsertRowid, '空腹血糖', 'GLU', 6.2, 'mmol/L', 3.9, 6.1, 1, 'high');
  insertInd.run(r2.lastInsertRowid, '糖化血红蛋白', 'HbA1c', 6.8, '%', 4.0, 6.0, 1, 'high');
  insertInd.run(r2.lastInsertRowid, '总胆固醇', 'TC', 5.3, 'mmol/L', 2.8, 5.2, 1, 'high');
  insertInd.run(r2.lastInsertRowid, '甘油三酯', 'TG', 1.8, 'mmol/L', 0.56, 1.70, 1, 'high');
  insertInd.run(r2.lastInsertRowid, '低密度脂蛋白', 'LDL', 3.1, 'mmol/L', 0, 3.4, 0, null);
  insertInd.run(r2.lastInsertRowid, '谷丙转氨酶', 'ALT', 28, 'U/L', 0, 40, 0, null);
  insertInd.run(r2.lastInsertRowid, '肌酐', 'CREA', 85, 'μmol/L', 44, 133, 0, null);
  insertInd.run(r2.lastInsertRowid, '白细胞', 'WBC', 5.8, '×10^9/L', 3.5, 9.5, 0, null);

  // Report 3: 2026-05-10
  const r3 = insertReport.run(userId, 'biochemical', '季度复查生化', '2026-05-10', '北京协和医院', '检验科');
  insertInd.run(r3.lastInsertRowid, '空腹血糖', 'GLU', 5.8, 'mmol/L', 3.9, 6.1, 0, null);
  insertInd.run(r3.lastInsertRowid, '糖化血红蛋白', 'HbA1c', 6.3, '%', 4.0, 6.0, 1, 'high');
  insertInd.run(r3.lastInsertRowid, '总胆固醇', 'TC', 4.9, 'mmol/L', 2.8, 5.2, 0, null);
  insertInd.run(r3.lastInsertRowid, '甘油三酯', 'TG', 1.5, 'mmol/L', 0.56, 1.70, 0, null);
  insertInd.run(r3.lastInsertRowid, '低密度脂蛋白', 'LDL', 2.8, 'mmol/L', 0, 3.4, 0, null);
  insertInd.run(r3.lastInsertRowid, '谷丙转氨酶', 'ALT', 25, 'U/L', 0, 40, 0, null);
  insertInd.run(r3.lastInsertRowid, '肌酐', 'CREA', 82, 'μmol/L', 44, 133, 0, null);
  insertInd.run(r3.lastInsertRowid, '白细胞', 'WBC', 6.1, '×10^9/L', 3.5, 9.5, 0, null);

  // Report 4: Imaging
  const r4 = insertReport.run(userId, 'imaging', '胸部CT平扫', '2026-02-15', '北京协和医院', '放射科');
  const insertFind = db.prepare(
    `INSERT INTO imaging_findings (report_id, body_part, modality, finding, impression) VALUES (?, ?, ?, ?, ?)`
  );
  insertFind.run(r4.lastInsertRowid, '胸部', 'CT', '双肺纹理清晰，未见实质性病变。纵隔居中，未见肿大淋巴结。心影大小形态正常。双侧胸膜未见增厚，胸腔未见积液。', '胸部CT平扫未见明显异常');

  console.log('  Health Reports: 4 records with indicators/findings inserted');
} else {
  console.log('  Health Reports: already exists, skipping');
}

// ── CGA Assessment ──
const existingCGA = db.prepare('SELECT COUNT(*) as cnt FROM cga_assessments WHERE user_id = ?').get(userId);
if (existingCGA.cnt === 0) {
  const result = db.prepare(
    `INSERT INTO cga_assessments (user_id, assessment_date, adl_score, adl_level, adl_data,
     iadl_score, iadl_data, frailty_score, frailty_data, nutrition_score, nutrition_data,
     cognitive_quick_data, depression_score, depression_data, fall_risk_score, fall_risk_data,
     social_data, overall_summary, recommendations, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId, '2026-06-01',
    85, 'mild_dependent',
    JSON.stringify({ '进食': 10, '洗澡': 5, '修饰': 5, '穿衣': 10, '大便控制': 10, '小便控制': 10, '如厕': 10, '床椅转移': 10, '平地行走': 10, '上下楼梯': 5 }),
    6,
    JSON.stringify({ '购物': 1, '烹饪': 1, '家务': 1, '洗衣': 0, '交通方式': 1, '药物管理': 1, '财务管理': 1, '电话使用': 0 }),
    1,
    JSON.stringify({ '体重下降': 0, '疲乏感': 0, '握力下降': 1, '步速减慢': 0, '活动减少': 0 }),
    10,
    JSON.stringify({ '进食量变化': 2, '体重下降': 1, '活动能力': 1, '应激/急性疾病': 2, '神经心理问题': 2, 'BMI': 2 }),
    JSON.stringify({ '词语回忆(0-3)': 2, '画钟测试(0/2)': 2 }),
    3,
    JSON.stringify({ 'q1': 0, 'q2': 0, 'q3': 1, 'q4': 0, 'q5': 0, 'q6': 0, 'q7': 0, 'q8': 0, 'q9': 0, 'q10': 1, 'q11': 0, 'q12': 1, 'q13': 0, 'q14': 0, 'q15': 0 }),
    15,
    JSON.stringify({ '跌倒史': 0, '二次诊断': 0, '助行器具': 0, '静脉输液': 0, '步态': 0, '精神状态': 15 }),
    JSON.stringify({ 'support': 'good', 'living': 'spouse' }),
    'ADL 评分: 85/100 (mild_dependent)\nFried 衰弱: 1/5 (衰弱前期)\nMNA-SF 营养: 10/14\nGDS-15 抑郁: 3/15\nMorse 跌倒: 15/125',
    '建议：维持目前运动量和社交活动；每6个月复查认知功能；维持低盐低脂饮食',
    'completed'
  );
  console.log('  CGA Assessment: 1 complete assessment inserted');
} else {
  console.log('  CGA Assessment: already exists, skipping');
}

// ── Cognitive Screening ──
const existingCognitive = db.prepare('SELECT COUNT(*) as cnt FROM cognitive_screenings WHERE user_id = ?').get(userId);
if (existingCognitive.cnt === 0) {
  db.prepare(
    `INSERT INTO cognitive_screenings (user_id, screening_date, screening_type, total_score, score_max,
     score_interpretation, subsection_scores, education_years, informant_available,
     ai_analysis, risk_level, follow_up_recommendation, status, score_change)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId, '2026-04-01', 'MMSE',
    26, 30, 'borderline',
    JSON.stringify({ orientation: 8, memory: 5, attention: 4, language: 7, visuospatial: 2 }),
    12, 1,
    'MMSE 评分: 26/30 — borderline。本次为首轮筛查，暂无可对比趋势。受检者受教育12年，近期记忆和注意力维度有轻微下降，建议关注日常认知功能变化，保持社交和脑力活动。',
    'moderate', '建议 6 个月后复查，关注认知变化', 'completed', null
  );

  db.prepare(
    `INSERT INTO cognitive_screenings (user_id, screening_date, screening_type, total_score, score_max,
     score_interpretation, subsection_scores, education_years, informant_available,
     ai_analysis, risk_level, follow_up_recommendation, status, score_change)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId, '2026-06-15', 'AD8',
    2, 8, 'impaired',
    JSON.stringify({ ad8_total: 2 }),
    12, 1,
    'AD8 评分: 2/8 — impaired。本次为首轮AD8筛查。两个阳性条目提示早期认知功能改变可能，建议进一步进行MMSE或MoCA评估以确认。',
    'high', '建议 3 个月内转诊神经内科，完善认知评估', 'completed', null
  );
  console.log('  Cognitive Screening: 2 records inserted');
} else {
  console.log('  Cognitive Screening: already exists, skipping');
}

console.log('\nSeed data complete! You can now refresh the web app.');
process.exit(0);
