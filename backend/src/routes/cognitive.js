import { Router } from 'express';
import { getDb } from '../database.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();
const SCREENING_TYPES = ['AD8', 'MMSE', 'MoCA', 'CDR', 'Mini_Cog', 'GPCOG'];

router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const screenings = db.prepare('SELECT * FROM cognitive_screenings WHERE user_id = ? ORDER BY screening_date DESC').all(req.user.id);
    res.json(screenings);
  } catch (err) { next(err); }
});

router.post('/', (req, res, next) => {
  try {
    const { screening_date, screening_type, education_years, informant_available, cga_assessment_id } = req.body;
    if (!screening_date || !screening_type) throw AppError.validation({ form: '筛查日期和筛查工具为必填项' });
    if (!SCREENING_TYPES.includes(screening_type)) throw AppError.validation({ screening_type: `不支持的筛查工具: ${screening_type}` });

    const db = getDb();
    const result = db.prepare(
      `INSERT INTO cognitive_screenings (user_id, screening_date, screening_type, education_years, informant_available, cga_assessment_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'tool_selection')`
    ).run(req.user.id, screening_date, screening_type, education_years || null, informant_available ? 1 : 0, cga_assessment_id || null);

    res.status(201).json({ id: result.lastInsertRowid, screening_type, status: 'tool_selection' });
  } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const screening = db.prepare('SELECT * FROM cognitive_screenings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!screening) throw AppError.notFound('筛查记录');
    res.json(screening);
  } catch (err) { next(err); }
});

router.put('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const screening = db.prepare('SELECT id, screening_type FROM cognitive_screenings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!screening) throw AppError.notFound('筛查记录');

    const { answers, informant_responses } = req.body;
    const scored = scoreScreening(screening.screening_type, answers);

    // Find previous screening for trend
    const prev = db.prepare(
      'SELECT total_score FROM cognitive_screenings WHERE user_id = ? AND screening_type = ? AND id < ? AND total_score IS NOT NULL ORDER BY id DESC LIMIT 1'
    ).get(req.user.id, screening.screening_type, screening.id);

    const scoreChange = prev ? scored.total - prev.total_score : null;

    db.prepare(
      `UPDATE cognitive_screenings SET total_score = ?, score_max = ?, score_interpretation = ?, subsection_scores = ?, status = 'scored', score_change = ?, informant_responses = ?
       WHERE id = ?`
    ).run(
      scored.total, scored.max, scored.interpretation, JSON.stringify(scored.subscores),
      scoreChange, informant_responses ? JSON.stringify(informant_responses) : null,
      screening.id
    );

    res.json({ total_score: scored.total, score_max: scored.max, interpretation: scored.interpretation, sub_scores: scored.subscores, score_change: scoreChange });
  } catch (err) { next(err); }
});

router.post('/:id/analyze', (req, res, next) => {
  try {
    const db = getDb();
    const screening = db.prepare('SELECT * FROM cognitive_screenings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!screening) throw AppError.notFound('筛查记录');
    if (!screening.total_score && screening.total_score !== 0) throw AppError.validation({ form: '请先完成量表填写' });

    const analysis = generateScreeningAnalysis(screening);
    db.prepare('UPDATE cognitive_screenings SET ai_analysis = ?, risk_level = ?, follow_up_recommendation = ?, status = ? WHERE id = ?')
      .run(analysis.text, analysis.risk, analysis.followUp, 'completed', screening.id);

    res.json({ analysis: analysis.text, risk_level: analysis.risk, follow_up: analysis.followUp });
  } catch (err) { next(err); }
});

router.get('/trend', (req, res, next) => {
  try {
    const db = getDb();
    const { screening_type } = req.query;
    let query = 'SELECT id, screening_date, screening_type, total_score, score_max, score_interpretation FROM cognitive_screenings WHERE user_id = ? AND total_score IS NOT NULL';
    const params = [req.user.id];
    if (screening_type) { query += ' AND screening_type = ?'; params.push(screening_type); }
    query += ' ORDER BY screening_date ASC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { next(err); }
});

function scoreScreening(type, answers) {
  if (type === 'AD8') {
    const total = Object.values(answers || {}).filter(v => v === 1).length;
    return { total, max: 8, interpretation: total >= 2 ? 'impaired' : 'normal', subscores: { ad8_total: total } };
  }
  if (type === 'MMSE') {
    const subs = { orientation: 0, memory: 0, attention: 0, language: 0, visuospatial: 0 };
    for (const [k, v] of Object.entries(answers || {})) {
      if (k.startsWith('o')) subs.orientation += (Number(v) || 0);
      else if (k.startsWith('m')) subs.memory += (Number(v) || 0);
      else if (k.startsWith('a')) subs.attention += (Number(v) || 0);
      else if (k.startsWith('l')) subs.language += (Number(v) || 0);
      else if (k.startsWith('v')) subs.visuospatial += (Number(v) || 0);
    }
    const total = Object.values(subs).reduce((a, b) => a + b, 0);
    return {
      total, max: 30,
      interpretation: total >= 27 ? 'normal' : total >= 21 ? 'borderline' : total >= 10 ? 'impaired' : 'severely_impaired',
      subscores: subs
    };
  }
  if (type === 'CDR') {
    const domains = answers || {};
    const scores = Object.values(domains).map(Number);
    const total = scores.reduce((a, b) => a + b, 0);
    return {
      total, max: 18,
      interpretation: total === 0 ? 'normal' : total <= 4 ? 'borderline' : total <= 9 ? 'impaired' : 'severely_impaired',
      subscores: domains
    };
  }
  // Default scoring
  const total = Object.values(answers || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  return { total, max: 30, interpretation: total > 25 ? 'normal' : 'impaired', subscores: answers || {} };
}

function generateScreeningAnalysis(s) {
  const changeText = s.score_change != null
    ? (s.score_change < 0 ? `较上次下降 ${Math.abs(s.score_change)} 分` : `较上次提升 ${s.score_change} 分`)
    : '首次筛查，无历史对比';

  let risk = 'low', followUp = '建议 12 个月后复查';
  if (s.score_interpretation === 'severely_impaired') { risk = 'very_high'; followUp = '建议立即转诊神经内科，进行进一步诊断评估（头颅 MRI、神经心理学评估）'; }
  else if (s.score_interpretation === 'impaired') { risk = 'high'; followUp = '建议 3 个月内转诊神经内科，完善认知评估'; }
  else if (s.score_interpretation === 'borderline') { risk = 'moderate'; followUp = '建议 6 个月后复查，关注认知变化'; }

  if (s.score_change != null && s.score_change < -3) { risk = 'high'; followUp = '分数显著下降，' + followUp; }

  return { text: `${s.screening_type} 评分: ${s.total_score}/${s.score_max} — ${s.score_interpretation}。${changeText}。`, risk, followUp };
}

export default router;
