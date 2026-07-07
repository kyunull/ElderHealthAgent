import { Router } from 'express';
import { getDb } from '../database.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// List all reminders for user
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const reminders = db.prepare(
      `SELECT r.*, m.drug_name, m.dosage, m.dosage_unit
       FROM medication_reminders r
       LEFT JOIN medications m ON r.medication_id = m.id
       WHERE r.user_id = ?
       ORDER BY r.remind_time ASC`
    ).all(req.user.id);
    res.json(reminders);
  } catch (err) { next(err); }
});

// Create a reminder
router.post('/', (req, res, next) => {
  try {
    const { medication_id, reminder_type, phone_number, remind_time, days_of_week } = req.body;
    if (!medication_id || !reminder_type || !remind_time) {
      throw AppError.validation({ form: '药物ID、提醒类型和提醒时间为必填项' });
    }
    if (!['sms', 'phone', 'app'].includes(reminder_type)) {
      throw AppError.validation({ reminder_type: '提醒类型无效' });
    }
    if (reminder_type !== 'app' && !phone_number) {
      throw AppError.validation({ phone_number: '短信/电话提醒需要提供手机号' });
    }

    const db = getDb();
    const result = db.prepare(
      `INSERT INTO medication_reminders (user_id, medication_id, reminder_type, phone_number, remind_time, days_of_week)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(req.user.id, medication_id, reminder_type, phone_number || null, remind_time, days_of_week || '1,2,3,4,5,6,7');

    res.status(201).json({ id: result.lastInsertRowid, message: '提醒已创建' });
  } catch (err) { next(err); }
});

// Update a reminder
router.put('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const reminder = db.prepare('SELECT id FROM medication_reminders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!reminder) throw AppError.notFound('提醒记录');

    const { enabled, remind_time, days_of_week, phone_number } = req.body;
    if (enabled !== undefined) db.prepare('UPDATE medication_reminders SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, reminder.id);
    if (remind_time) db.prepare('UPDATE medication_reminders SET remind_time = ? WHERE id = ?').run(remind_time, reminder.id);
    if (days_of_week) db.prepare('UPDATE medication_reminders SET days_of_week = ? WHERE id = ?').run(days_of_week, reminder.id);
    if (phone_number) db.prepare('UPDATE medication_reminders SET phone_number = ? WHERE id = ?').run(phone_number, reminder.id);

    res.json({ success: true });
  } catch (err) { next(err); }
});

// Delete a reminder
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const reminder = db.prepare('SELECT id FROM medication_reminders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!reminder) throw AppError.notFound('提醒记录');
    db.prepare('DELETE FROM medication_reminders WHERE id = ?').run(reminder.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
