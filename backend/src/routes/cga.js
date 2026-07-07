import { Router } from 'express';
import { getDb } from '../database.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();
const DIMENSIONS = ['adl', 'iadl', 'frailty', 'nutrition', 'cognitive_quick', 'depression', 'fall_risk', 'social'];

router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const assessments = db.prepare('SELECT * FROM cga_assessments WHERE user_id = ? ORDER BY assessment_date DESC').all(req.user.id);
    res.json(assessments);
  } catch (err) { next(err); }
});

router.post('/', (req, res, next) => {
  try {
    const { assessment_date } = req.body;
    if (!assessment_date) throw AppError.validation({ assessment_date: '评估日期为必填项' });

    const db = getDb();
    const result = db.prepare('INSERT INTO cga_assessments (user_id, assessment_date) VALUES (?, ?)').run(req.user.id, assessment_date);
    res.status(201).json({ id: result.lastInsertRowid, status: 'draft' });
  } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const assessment = db.prepare('SELECT * FROM cga_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!assessment) throw AppError.notFound('评估记录');
    res.json(assessment);
  } catch (err) { next(err); }
});

router.put('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const assessment = db.prepare('SELECT id FROM cga_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!assessment) throw AppError.notFound('评估记录');

    const { dimension, data } = req.body;
    if (!dimension || !DIMENSIONS.includes(dimension)) {
      throw AppError.validation({ dimension: `维度无效，可选: ${DIMENSIONS.join(', ')}` });
    }

    db.prepare(`UPDATE cga_assessments SET ${dimension}_data = ?, status = 'in_progress' WHERE id = ?`)
      .run(JSON.stringify(data), assessment.id);

    // Auto-calculate scores based on dimension
    if (dimension === 'adl') {
      const score = Object.values(data).reduce((sum, v) => sum + (Number(v) || 0), 0);
      let level = 'independent';
      if (score < 20) level = 'total_dependent';
      else if (score < 40) level = 'severe_dependent';
      else if (score < 60) level = 'moderate_dependent';
      else if (score < 80) level = 'mild_dependent';
      db.prepare('UPDATE cga_assessments SET adl_score = ?, adl_level = ? WHERE id = ?').run(score, level, assessment.id);
    } else if (dimension === 'iadl') {
      const score = Object.values(data).reduce((sum, v) => sum + (Number(v) || 0), 0);
      db.prepare('UPDATE cga_assessments SET iadl_score = ? WHERE id = ?').run(score, assessment.id);
    } else if (dimension === 'frailty') {
      const score = Object.values(data).filter(v => Number(v) === 1).length;
      db.prepare('UPDATE cga_assessments SET frailty_score = ? WHERE id = ?').run(score, assessment.id);
    } else if (dimension === 'nutrition') {
      const score = Object.values(data).reduce((sum, v) => sum + (Number(v) || 0), 0);
      db.prepare('UPDATE cga_assessments SET nutrition_score = ? WHERE id = ?').run(score, assessment.id);
    } else if (dimension === 'cognitive_quick') {
      const score = Object.values(data).reduce((sum, v) => sum + (Number(v) || 0), 0);
      db.prepare('UPDATE cga_assessments SET cognitive_score = ? WHERE id = ?').run(score, assessment.id);
    } else if (dimension === 'depression') {
      const score = Object.values(data).filter(v => Number(v) === 1).length;
      db.prepare('UPDATE cga_assessments SET depression_score = ? WHERE id = ?').run(score, assessment.id);
    } else if (dimension === 'fall_risk') {
      const score = Object.values(data).reduce((sum, v) => sum + (Number(v) || 0), 0);
      db.prepare('UPDATE cga_assessments SET fall_risk_score = ? WHERE id = ?').run(score, assessment.id);
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/:id/analyze', (req, res, next) => {
  try {
    const db = getDb();
    const assessment = db.prepare('SELECT * FROM cga_assessments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!assessment) throw AppError.notFound('评估记录');

    const completedDims = DIMENSIONS.filter(d => assessment[`${d}_data`]);
    if (completedDims.length < DIMENSIONS.length) {
      throw new AppError(400, 'CGA_INCOMPLETE', `还有 ${DIMENSIONS.length - completedDims.length} 个维度未完成评估`, {
        total: DIMENSIONS.length, completed: completedDims.length,
        pending: DIMENSIONS.filter(d => !assessment[`${d}_data`])
      });
    }

    const apiKey = db.prepare('SELECT api_key_encrypted FROM users WHERE id = ?').get(req.user.id);
    if (!apiKey?.api_key_encrypted) throw AppError.apiKeyRequired();

    // Generate summary from scores
    const summary = generateCGASummary(assessment);
    db.prepare('UPDATE cga_assessments SET overall_summary = ?, recommendations = ?, status = ? WHERE id = ?')
      .run(summary.text, summary.recommendations, 'completed', assessment.id);

    res.json({ summary: summary.text, recommendations: summary.recommendations });
  } catch (err) { next(err); }
});

function generateCGASummary(a) {
  const parts = [];
  const recs = [];

  if (a.adl_score != null) {
    parts.push(`ADL 评分: ${a.adl_score}/100 (${a.adl_level})`);
    if (a.adl_score < 60) recs.push('建议：评估居家护理需求和辅助器具');
  }
  if (a.frailty_score != null) {
    const cat = a.frailty_score >= 3 ? '衰弱' : a.frailty_score >= 1 ? '衰弱前期' : '健壮';
    parts.push(`Fried 衰弱: ${a.frailty_score}/5 (${cat})`);
    if (a.frailty_score >= 3) recs.push('建议：启动多组分干预（抗阻运动+营养补充+用药审查）');
  }
  if (a.nutrition_score != null) {
    parts.push(`MNA-SF 营养: ${a.nutrition_score}/14`);
    if (a.nutrition_score <= 7) recs.push('建议：营养科会诊，ONS 口服营养补充');
  }
  if (a.depression_score != null) {
    parts.push(`GDS-15 抑郁: ${a.depression_score}/15`);
    if (a.depression_score >= 5) recs.push('建议：心理科评估');
  }
  if (a.fall_risk_score != null) {
    parts.push(`Morse 跌倒: ${a.fall_risk_score}/125`);
    if (a.fall_risk_score > 45) recs.push('建议：防跌倒干预（居家环境改造、平衡训练、用药审查）');
  }

  return {
    text: parts.join('\n'),
    recommendations: recs.join('；') || '建议定期随访'
  };
}

export default router;
