import { Router } from 'express';
import { getDb } from '../database.js';
import { AppError } from '../middleware/error-handler.js';
import { callVisionAPI } from '../services/ai-extraction.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new AppError(400, '仅支持 JPG、PNG、WebP 格式的图片'));
  }
});

// Route display map
const ROUTE_MAP = {
  oral: '口服', topical: '外用', injection: '注射', inhalation: '吸入',
  sublingual: '舌下含服', rectal: '直肠给药', ophthalmic: '眼用', otic: '耳用',
  nasal: '鼻用', transdermal: '透皮贴剂', other: '其他'
};

// Smart frequency parser: natural language → structured data
function parseFrequency(input) {
  const text = (input || '').toLowerCase().replace(/\s+/g, '');

  const result = {
    frequency: input,      // original input preserved
    freqCode: 'qd',        // standard code: qd/bid/tid/qid/hs/prn
    timing: 'any',         // before_meal/after_meal/empty_stomach/bedtime/any
    timesPerDay: 1,
    scheduleTimes: null    // "08:00,12:00,18:00" etc.
  };

  // Detect meal timing
  if (text.includes('饭前') || text.includes('餐前') || text.includes('空腹')) {
    result.timing = text.includes('空腹') ? 'empty_stomach' : 'before_meal';
  } else if (text.includes('饭后') || text.includes('餐后')) {
    result.timing = 'after_meal';
  } else if (text.includes('睡前')) {
    result.timing = 'bedtime';
  }

  // Detect frequency
  if (text.includes('一次') || text.includes('1次')) {
    if (text.includes('一天') || text.includes('每日') || text.includes('每天')) {
      if (text.includes('两') || text.includes('2次')) { result.freqCode = 'bid'; result.timesPerDay = 2; }
      else if (text.includes('三') || text.includes('3次')) { result.freqCode = 'tid'; result.timesPerDay = 3; }
      else if (text.includes('四') || text.includes('4次')) { result.freqCode = 'qid'; result.timesPerDay = 4; }
      else { result.freqCode = 'qd'; result.timesPerDay = 1; }
    }
    if (text.includes('周') || text.includes('每周')) { result.freqCode = 'qw'; result.timesPerDay = 1; }
  } else if (text.includes('bid') || text.includes('每日两次') || text.includes('早晚各') || text.includes('早晚')) {
    result.freqCode = 'bid'; result.timesPerDay = 2;
  } else if (text.includes('tid') || text.includes('每日三次') || text.includes('早中晚')) {
    result.freqCode = 'tid'; result.timesPerDay = 3;
  } else if (text.includes('qid') || text.includes('每日四次')) {
    result.freqCode = 'qid'; result.timesPerDay = 4;
  } else if (text.includes('hs') || text.includes('睡前')) {
    result.freqCode = 'hs'; result.timesPerDay = 1;
  } else if (text.includes('prn') || text.includes('按需') || text.includes('必要时')) {
    result.freqCode = 'prn'; result.timesPerDay = 1;
  }

  // Generate schedule times
  if (result.timing === 'bedtime') {
    result.scheduleTimes = '21:00';
  } else if (result.timesPerDay === 1) {
    result.scheduleTimes = result.timing === 'empty_stomach' ? '07:00' : '08:00';
  } else if (result.timesPerDay === 2) {
    result.scheduleTimes = '08:00,20:00';
  } else if (result.timesPerDay === 3) {
    result.scheduleTimes = '08:00,12:00,18:00';
  } else if (result.timesPerDay === 4) {
    result.scheduleTimes = '08:00,12:00,18:00,21:00';
  }

  return result;
}

function freqToChinese(freqCode) {
  const map = { qd: '每日一次', bid: '每日两次', tid: '每日三次', qid: '每日四次', hs: '睡前一次', prn: '按需服用', qw: '每周一次', qod: '隔日一次' };
  return map[freqCode] || freqCode;
}

function timingToChinese(timing) {
  const map = { before_meal: '饭前', after_meal: '饭后', empty_stomach: '空腹', bedtime: '睡前', any: '不限' };
  return map[timing] || timing;
}

router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const { status } = req.query;
    let query = 'SELECT * FROM medications WHERE user_id = ?';
    const params = [req.user.id];
    if (status) { query += ' AND status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC';
    const meds = db.prepare(query).all(...params);
    // Enrich with Chinese labels
    for (const m of meds) {
      m.route_cn = ROUTE_MAP[m.route] || m.route;
      m.timing_cn = timingToChinese(m.timing);
      m.frequency_cn = freqToChinese(parseFrequency(m.frequency).freqCode);
    }
    res.json(meds);
  } catch (err) { next(err); }
});

// Get medication schedule (for dashboard)
router.get('/schedule', (req, res, next) => {
  try {
    const db = getDb();
    const meds = db.prepare("SELECT * FROM medications WHERE user_id = ? AND status = 'active'").all(req.user.id);

    const slots = [
      { label: '早晨', time: '07:00-08:00', icon: '🌅', items: [] },
      { label: '上午', time: '08:00-12:00', icon: '☀️', items: [] },
      { label: '中午', time: '12:00-13:00', icon: '🌤️', items: [] },
      { label: '下午', time: '13:00-18:00', icon: '🌤️', items: [] },
      { label: '晚上', time: '18:00-21:00', icon: '🌙', items: [] },
      { label: '睡前', time: '21:00-22:00', icon: '🌛', items: [] }
    ];

    for (const m of meds) {
      const times = m.schedule_times ? m.schedule_times.split(',') : ['08:00'];

      for (const t of times) {
        const hour = parseInt(t.split(':')[0]);
        let slotIdx;
        if (hour < 8) slotIdx = 0;
        else if (hour < 12) slotIdx = 1;
        else if (hour < 13) slotIdx = 2;
        else if (hour < 18) slotIdx = 3;
        else if (hour < 21) slotIdx = 4;
        else slotIdx = 5;

        slots[slotIdx].items.push({
          id: m.id,
          drug_name: m.drug_name,
          dosage: m.dosage,
          dosage_unit: m.dosage_unit || '',
          route_cn: ROUTE_MAP[m.route] || m.route,
          timing_cn: timingToChinese(m.timing || 'any'),
          schedule_time: t
        });
      }
    }

    // Deduplicate same drug in same slot
    for (const slot of slots) {
      const seen = new Set();
      slot.items = slot.items.filter(item => {
        const key = `${item.id}-${item.schedule_time}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    const nonEmpty = slots.filter(s => s.items.length > 0);
    res.json(nonEmpty);
  } catch (err) { next(err); }
});

router.post('/', (req, res, next) => {
  try {
    const { drug_name, generic_name, dosage, dosage_unit, spec_per_pill_mg, frequency, route, start_date, end_date, notes } = req.body;
    if (!drug_name || !dosage || !frequency || !start_date) {
      throw AppError.validation({ form: '药品名、剂量、频率和开始日期为必填项' });
    }

    const freq = parseFrequency(frequency);
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO medications (user_id, drug_name, generic_name, dosage, dosage_unit, spec_per_pill_mg, frequency, route, start_date, end_date, timing, schedule_times, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.user.id, drug_name, generic_name || null, dosage, dosage_unit || null,
      spec_per_pill_mg ? parseFloat(spec_per_pill_mg) : null,
      frequency, route || 'oral',
      start_date, end_date || null, freq.timing, freq.scheduleTimes, notes || null);

    const medication = db.prepare('SELECT * FROM medications WHERE id = ?').get(result.lastInsertRowid);
    medication.route_cn = ROUTE_MAP[medication.route] || medication.route;
    medication.timing_cn = timingToChinese(medication.timing);
    medication.frequency_cn = freqToChinese(parseFrequency(medication.frequency).freqCode);
    res.status(201).json(medication);
  } catch (err) { next(err); }
});

router.put('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const med = db.prepare('SELECT * FROM medications WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!med) throw AppError.notFound('用药记录');

    const { drug_name, generic_name, dosage, dosage_unit, spec_per_pill_mg, frequency, route, start_date, end_date, notes, status } = req.body;

    // Support both partial status-only updates and full-field updates
    const updates = {};
    if (drug_name !== undefined) updates.drug_name = drug_name;
    if (generic_name !== undefined) updates.generic_name = generic_name || null;
    if (dosage !== undefined) updates.dosage = dosage;
    if (dosage_unit !== undefined) updates.dosage_unit = dosage_unit || null;
    if (spec_per_pill_mg !== undefined) updates.spec_per_pill_mg = spec_per_pill_mg ? parseFloat(spec_per_pill_mg) : null;
    if (frequency !== undefined) {
      updates.frequency = frequency;
      const freq = parseFrequency(frequency);
      updates.timing = freq.timing;
      updates.schedule_times = freq.scheduleTimes;
    }
    if (route !== undefined) updates.route = route || 'oral';
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date || null;
    if (notes !== undefined) updates.notes = notes || null;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return res.json({ success: true });
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    db.prepare(`UPDATE medications SET ${setClauses} WHERE id = ?`).run(...values, med.id);

    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const med = db.prepare('SELECT id FROM medications WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!med) throw AppError.notFound('用药记录');
    db.prepare('DELETE FROM medications WHERE id = ?').run(med.id);
    db.prepare('DELETE FROM medication_reminders WHERE medication_id = ?').run(med.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/interactions/check', (req, res, next) => {
  try {
    const db = getDb();
    const meds = db.prepare("SELECT * FROM medications WHERE user_id = ? AND status IN ('active','paused')").all(req.user.id);
    if (meds.length < 2) return res.json({ interactions: [], total_count: 0, x_count: 0, d_count: 0 });

    const interactions = [];
    for (let i = 0; i < meds.length; i++) {
      for (let j = i + 1; j < meds.length; j++) {
        const result = db.prepare(
          `SELECT * FROM drug_interactions_db WHERE (drug_a = ? AND drug_b = ?) OR (drug_a = ? AND drug_b = ?)`
        ).get(meds[i].drug_name, meds[j].drug_name, meds[j].drug_name, meds[i].drug_name);
        if (result) {
          interactions.push({
            drug_pair: `${meds[i].drug_name} + ${meds[j].drug_name}`,
            severity: result.severity,
            mechanism: result.mechanism,
            management: result.management,
            medication_ids: [meds[i].id, meds[j].id]
          });
        }
      }
    }

    interactions.sort((a, b) => ['X','D','C','B','A'].indexOf(a.severity) - ['X','D','C','B','A'].indexOf(b.severity));
    const x_count = interactions.filter(i => i.severity === 'X').length;
    const d_count = interactions.filter(i => i.severity === 'D').length;

    res.json({ interactions, total_count: interactions.length, x_count, d_count });
  } catch (err) { next(err); }
});

// OCR recognize medicine bottle/label
router.post('/ocr-recognize', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) throw AppError.validation({ image: '请上传药瓶或药品说明书照片' });

    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const prompt = `你是一个药品信息识别助手。请识别这张药瓶/药品包装/药品说明书照片中的信息。

请提取以下信息并以JSON格式返回（无法识别的字段用 null）：
{
  "drug_name": "药品商品名（如：络活喜）",
  "generic_name": "通用名/化学成分（如：苯磺酸氨氯地平片）",
  "spec_per_pill": "每片规格（mg数，纯数字，如：5）",
  "spec_unit": "规格单位，通常为mg",
  "manufacturer": "生产厂家",
  "usage_direction": "说明书中的用法用量描述",
  "indications": "适应症简述",
  "warnings": "重要注意事项",
  "confidence": "识别置信度 high/medium/low"
}

注意：
- 请仔细阅读药瓶或包装上的文字
- 剂量数字要精确，区分"5mg"和"50mg"等
- 如果文字模糊不清，把confidence设为low并在相应字段如实反映
- 只返回JSON，不要加其他文字`;

    const textContent = await callVisionAPI(base64Image, mimeType, prompt, req.user.id);

    // Extract JSON from response
    let drugInfo;
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      drugInfo = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      drugInfo = null;
    }

    if (!drugInfo || !drugInfo.drug_name) {
      // Return raw text if JSON parsing failed
      drugInfo = { drug_name: null, generic_name: null, spec_per_pill: null, spec_unit: 'mg', raw_text: textContent, confidence: 'low' };
    }

    // Calculate pill conversion
    let pillConversion = null;
    if (drugInfo.spec_per_pill && drugInfo.spec_unit === 'mg') {
      pillConversion = {
        per_pill_mg: drugInfo.spec_per_pill,
        common_dosages: generatePillConversion(drugInfo.spec_per_pill)
      };
    }

    res.json({ drug_info: drugInfo, pill_conversion: pillConversion });
  } catch (err) { next(err); }
});

// Generate friendly pill conversion table
function generatePillConversion(mgPerPill) {
  const mg = parseFloat(mgPerPill);
  if (!mg || mg <= 0) return null;

  const commonTargets = [5, 10, 20, 25, 50, 100, 200, 500];
  const conversions = [];

  for (const target of commonTargets) {
    const pills = target / mg;
    if (pills >= 0.25 && pills <= 4 && Number.isInteger(pills * 4)) {
      // Only include reasonable conversions (quarter pill to 4 pills)
      const fraction = pills < 1 ? formatFraction(pills) : pills.toString();
      conversions.push({
        target_mg: target,
        pill_count: fraction,
        readable: `${target}mg = ${fraction}片`
      });
    }
  }

  return conversions;
}

function formatFraction(value) {
  if (value === 0.25) return '¼';
  if (value === 0.5) return '½';
  if (value === 0.75) return '¾';
  if (value === 0.125) return '⅛';
  if (value === 0.3333333333333333) return '⅓';
  return value.toString();
}

// Friendly drug info display
router.post('/friendly-info', (req, res, next) => {
  try {
    const { drug_name, generic_name, dosage, dosage_unit, spec_per_pill_mg } = req.body;
    if (!drug_name || !dosage) throw AppError.validation({ form: '药品名和剂量为必填项' });

    const mgPerPill = parseFloat(spec_per_pill_mg) || 0;
    const dosageNum = parseFloat(dosage) || 0;
    const unit = dosage_unit || 'mg';

    let friendly = '';
    let pillInfo = null;

    // Build friendly description
    friendly += `${drug_name}`;
    if (generic_name && generic_name !== drug_name) {
      friendly += `（通用名：${generic_name}）`;
    }

    if (unit === 'mg' && mgPerPill > 0) {
      const pillCount = dosageNum / mgPerPill;
      if (Number.isInteger(pillCount)) {
        pillInfo = {
          mg_per_pill: mgPerPill,
          pill_count: pillCount,
          readable: `每次${pillCount}片（每片${mgPerPill}mg，共${dosageNum}mg）`
        };
        friendly += `\n每片含${mgPerPill}mg，每次需要吃${pillCount}片，总共${dosageNum}mg。`;
      } else if (pillCount === 0.5) {
        pillInfo = {
          mg_per_pill: mgPerPill,
          pill_count: '½',
          readable: `每次半片（每片${mgPerPill}mg，共${dosageNum}mg）`
        };
        friendly += `\n每片含${mgPerPill}mg，每次需要吃半片（可以沿刻痕掰开），总共${dosageNum}mg。`;
      } else if (pillCount === 0.25) {
        pillInfo = {
          mg_per_pill: mgPerPill,
          pill_count: '¼',
          readable: `每次¼片（每片${mgPerPill}mg，共${dosageNum}mg）`
        };
        friendly += `\n每片含${mgPerPill}mg，每次只需要¼片，总量${dosageNum}mg。`;
      } else {
        const rounded = Math.round(pillCount * 4) / 4;
        pillInfo = {
          mg_per_pill: mgPerPill,
          pill_count: rounded,
          readable: `每次约${rounded}片（每片${mgPerPill}mg，共${dosageNum}mg）`
        };
        friendly += `\n每片含${mgPerPill}mg，每次需要吃大约${rounded}片（共${dosageNum}mg）。建议和医生或药师确认用量。`;
      }
    } else {
      friendly += `\n每次用量：${dosageNum}${unit}`;
    }

    res.json({ friendly_message: friendly, pill_info: pillInfo });
  } catch (err) { next(err); }
});

export default router;
