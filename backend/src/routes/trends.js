import { Router } from 'express';
import { getDb } from '../database.js';

const router = Router();

router.get('/:indicatorCode', (req, res, next) => {
  try {
    const db = getDb();
    const { indicatorCode } = req.params;
    const period = req.query.period || '6m';

    const periodMap = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, 'all': 1200 };
    const months = periodMap[period] || 6;
    const dateLimit = new Date();
    dateLimit.setMonth(dateLimit.getMonth() - months);

    const rows = db.prepare(`
      SELECT b.value, b.unit, b.reference_range_low, b.reference_range_high, h.report_date
      FROM biochemical_indicators b
      JOIN health_reports h ON b.report_id = h.id
      WHERE h.user_id = ? AND b.indicator_code = ? AND h.status = 'confirmed'
        AND h.report_date >= ?
      ORDER BY h.report_date ASC
    `).all(req.user.id, indicatorCode, dateLimit.toISOString().slice(0, 10));

    if (rows.length === 0) {
      return res.json({
        indicator_code: indicatorCode,
        period,
        data_points: [],
        message: '暂无历史数据'
      });
    }

    const dataPoints = rows.map(r => ({ date: r.report_date, value: r.value }));
    const values = rows.map(r => r.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    let direction = 'stable';
    if (rows.length >= 2) {
      const first = rows[0].value;
      const last = rows[rows.length - 1].value;
      const pctChange = (last - first) / Math.abs(first) * 100;
      if (pctChange > 10) direction = 'increasing';
      else if (pctChange < -10) direction = 'decreasing';
      else if (Math.abs(pctChange) > 3) direction = 'fluctuating';
    }

    res.json({
      indicator_code: indicatorCode,
      period,
      data_points: dataPoints,
      trend_direction: direction,
      min_value: min,
      max_value: max,
      avg_value: Math.round(avg * 100) / 100,
      reference_range: rows[0].reference_range_low ? {
        low: rows[0].reference_range_low,
        high: rows[0].reference_range_high
      } : null
    });
  } catch (err) { next(err); }
});

export default router;
