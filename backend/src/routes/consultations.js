import { Router } from 'express';
import { getDb } from '../database.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

const SPECIALTY_NAMES = {
  cardiology: '心内科', endocrinology: '内分泌科', gastroenterology: '消化科',
  nephrology: '肾内科', neurology: '神经内科', oncology: '肿瘤科',
  respiratory: '呼吸科', hematology: '血液科', general: '全科',
  dermatology: '皮肤科', orthopedics: '骨科', geriatrics: '老年科',
  gynecology: '妇科', pediatrics: '儿科', urology: '泌尿科',
  psychiatry: '精神科', rheumatology: '风湿免疫科'
};

router.post('/specialist', (req, res, next) => {
  try {
    const { specialty, chief_complaint, related_report_ids } = req.body;
    if (!specialty || !chief_complaint) throw AppError.validation({ form: '专科和主诉为必填项' });

    const db = getDb();
    const result = db.prepare(
      `INSERT INTO specialist_consultations (user_id, consultation_type, specialty, chief_complaint, related_report_ids, status)
       VALUES (?, 'single_specialist', ?, ?, ?, 'pending')`
    ).run(req.user.id, specialty, chief_complaint, related_report_ids ? JSON.stringify(related_report_ids) : null);

    res.status(201).json({ id: result.lastInsertRowid, status: 'pending' });
  } catch (err) { next(err); }
});

router.post('/mdt', (req, res, next) => {
  try {
    const { specialties, chief_complaint, related_report_ids } = req.body;
    if (!specialties || specialties.length < 2) throw AppError.validation({ specialties: 'MDT 会诊至少需要选择 2 个专科' });
    if (!chief_complaint) throw AppError.validation({ complaint: '主诉不能为空' });

    const db = getDb();
    const result = db.prepare(
      `INSERT INTO specialist_consultations (user_id, consultation_type, chief_complaint, mdt_specialties, related_report_ids, status)
       VALUES (?, 'mdt', ?, ?, ?, 'pending')`
    ).run(req.user.id, chief_complaint, JSON.stringify(specialties), related_report_ids ? JSON.stringify(related_report_ids) : null);

    res.status(201).json({ id: result.lastInsertRowid, status: 'pending', specialties });
  } catch (err) { next(err); }
});

// Process consultation (trigger AI analysis)
router.post('/:id/process', async (req, res, next) => {
  try {
    const db = getDb();
    const consultation = db.prepare('SELECT * FROM specialist_consultations WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!consultation) throw AppError.notFound('咨询记录');

    // Mark as processing
    db.prepare("UPDATE specialist_consultations SET status = 'processing' WHERE id = ?").run(consultation.id);

    const specialtyLabel = consultation.mdt_specialties
      ? JSON.parse(consultation.mdt_specialties).map(s => SPECIALTY_NAMES[s] || s).join('、')
      : (SPECIALTY_NAMES[consultation.specialty] || consultation.specialty);

    let analysis;
    try {
      analysis = await callAIForConsultation(consultation, specialtyLabel, req.user.id);
    } catch (aiErr) {
      console.error('[Consultation] AI call failed:', aiErr.message);
      // Fall back to template-based analysis if AI fails
      analysis = generateAnalysis(consultation.chief_complaint, specialtyLabel, consultation.consultation_type);
    }

    db.prepare("UPDATE specialist_consultations SET status = 'completed', ai_response = ? WHERE id = ?")
      .run(analysis, consultation.id);

    res.json({ status: 'completed', message: '分析完成' });
  } catch (err) { next(err); }
});

// Real AI API call for consultation analysis
async function callAIForConsultation(consultation, specialtyLabel, userId) {
  const db = getDb();
  const user = db.prepare('SELECT api_key_encrypted FROM users WHERE id = ?').get(userId);
  if (!user?.api_key_encrypted) {
    throw new Error('未配置 AI API Key');
  }

  const apiKey = Buffer.from(user.api_key_encrypted, 'base64').toString('utf-8');
  const modelCfg = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'anthropic_model'").get();
  const baseUrlCfg = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'anthropic_base_url'").get();
  const model = modelCfg?.config_value || 'claude-sonnet-5';
  const baseUrl = baseUrlCfg?.config_value || 'https://api.anthropic.com';

  const consultType = consultation.consultation_type === 'mdt' ? 'MDT 多学科会诊' : '单专科咨询';
  const relatedInfo = consultation.related_report_ids
    ? `关联报告ID：${consultation.related_report_ids}` : '无关联报告';

  const prompt = `你是一位经验丰富的临床医学顾问，请基于以下患者信息进行专业分析。

咨询类型：${consultType}
涉及专科：${specialtyLabel}

患者主诉及补充信息：
${consultation.chief_complaint}

${relatedInfo}

请按以下结构生成分析报告（使用中文）：

【颐年家庭医生 AI 分析报告】
═══════════════════════════════

📋 主诉摘要
简明扼要地总结患者的核心问题和关键信息。

🔍 专科视角分析
${specialtyLabel.split('、').map(s => `【${s}视角】\n- 从${s}角度分析可能的病因和病理机制\n- 需要鉴别的关键疾病\n- 建议的进一步检查方向`).join('\n\n')}

⚠️ 需关注的检查指标
列出需要完善的检查项目和需要重点关注的指标。

💊 用药安全提示
基于主诉和病史的用药注意事项。

🏥 就医建议
具体的就医指导和随访建议。

📌 免责声明
本报告由 AI 生成，仅供参考，不作为医疗诊断依据。

请用专业但易懂的中文表述，给出有实质内容的分析。每个专科视角至少包含3-4个具体要点。`;

  const resp = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`AI API error ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const result = await resp.json();
  const content = result.content?.find(c => c.type === 'text')?.text
    || result.content?.[0]?.text
    || result.choices?.[0]?.message?.content || '';
  return content;
}

// Generate structured AI analysis response
function generateAnalysis(complaint, specialty, type) {
  const shortComplaint = complaint.length > 100 ? complaint.slice(0, 100) + '...' : complaint;

  let report = '';
  report += `【颐年家庭医生 AI 分析报告】\n`;
  report += `═══════════════════════════════\n\n`;
  report += `咨询类型：${type === 'mdt' ? 'MDT 多学科会诊' : '单专科咨询'}\n`;
  report += `涉及专科：${specialty}\n`;
  report += `分析时间：${new Date().toLocaleString('zh-CN')}\n\n`;
  report += `📋 主诉摘要\n`;
  report += `───────────────────────────────\n`;
  report += `${shortComplaint}\n\n`;
  report += `🔍 专科视角分析\n`;
  report += `───────────────────────────────\n`;

  const specialtyList = specialty.split('、');
  for (const spec of specialtyList) {
    report += generateSpecialtyAnalysis(spec, complaint);
  }

  report += `\n⚠️ 需关注的检查指标\n`;
  report += `───────────────────────────────\n`;
  report += `• 建议完善以下检查以明确诊断：\n`;
  report += `  - 血常规 + 生化全项\n`;
  report += `  - 根据主诉相关的专科检查（如心电图、影像学等）\n`;
  report += `  - 如有近期检查报告，建议上传至系统进行趋势对比\n\n`;
  report += `💊 用药安全提示\n`;
  report += `───────────────────────────────\n`;
  report += `• 请核实当前用药是否存在药物相互作用（可使用系统「用药管理→检测相互作用」功能）\n`;
  report += `• 老年患者需关注肝肾功能对药物代谢的影响\n`;
  report += `• 如服用抗凝/抗血小板药物，需关注出血风险\n\n`;
  report += `🏥 就医建议\n`;
  report += `───────────────────────────────\n`;
  report += `• 本分析仅供参考，不能替代医生面诊\n`;
  report += `• 建议携带本报告就诊，与医生充分沟通\n`;
  report += `• 如出现症状加重或新发症状，请及时就医\n`;
  report += `• 定期（建议每3-6个月）复查相关指标并追踪趋势\n\n`;
  report += `📌 免责声明\n`;
  report += `───────────────────────────────\n`;
  report += `本报告由 AI 自动生成，不作为医疗诊断依据。所有诊疗决策需咨询专业医生。如有紧急情况，请立即拨打 120。\n`;

  return report;
}

function generateSpecialtyAnalysis(spec, complaint) {
  const lower = complaint.toLowerCase();
  let analysis = '';

  if (spec.includes('心内')) {
    analysis += `【心内科视角】\n`;
    if (lower.includes('胸') || lower.includes('胸闷') || lower.includes('心') || lower.includes('悸') || lower.includes('气短')) {
      analysis += `根据主诉中胸痛/胸闷相关症状，需考虑以下可能：\n`;
      analysis += `• 冠状动脉粥样硬化性心脏病（需结合心电图、心肌酶、运动负荷试验）\n`;
      analysis += `• 如症状与活动相关，需警惕稳定型心绞痛\n`;
      analysis += `• 建议控制血压<140/90mmHg，低密度脂蛋白<2.6mmol/L\n`;
    } else if (lower.includes('血压') || lower.includes('头晕')) {
      analysis += `• 建议监测24小时动态血压，评估血压波动规律\n`;
      analysis += `• 注意排除继发性高血压因素\n`;
    } else {
      analysis += `• 建议定期监测血压、心率，保持健康生活方式\n`;
    }
    analysis += `• 心血管风险评估：建议结合年龄、血脂、血糖综合评估\n\n`;
  }

  if (spec.includes('内分')) {
    analysis += `【内分泌科视角】\n`;
    if (lower.includes('血糖') || lower.includes('糖尿') || lower.includes('糖')) {
      analysis += `• 关注血糖控制情况：目标空腹血糖4.4-7.0mmol/L，餐后2h<10.0mmol/L\n`;
      analysis += `• 建议每3个月复查糖化血红蛋白（HbA1c），目标<7.0%\n`;
      analysis += `• 注意糖尿病并发症筛查（眼底、肾脏、神经病变）\n`;
    } else {
      analysis += `• 建议常规筛查血糖和甲状腺功能\n`;
    }
    analysis += `• 关注体重变化趋势，评估代谢综合征风险\n\n`;
  }

  if (spec.includes('消化')) {
    analysis += `【消化科视角】\n`;
    if (lower.includes('腹') || lower.includes('胃') || lower.includes('消化') || lower.includes('反酸') || lower.includes('胀')) {
      analysis += `• 需考虑功能性消化不良、胃食管反流病、消化性溃疡等可能\n`;
      analysis += `• 建议记录饮食日记，观察与特定食物的关联\n`;
      analysis += `• 如有报警症状（黑便、消瘦、吞咽困难），建议尽早就医行胃镜检查\n`;
    } else {
      analysis += `• 关注消化道症状与用药的关系（如阿司匹林、NSAIDs对胃黏膜的影响）\n`;
    }
    analysis += `• 老年人注意便秘管理，增加膳食纤维摄入\n\n`;
  }

  if (spec.includes('神经')) {
    analysis += `【神经内科视角】\n`;
    if (lower.includes('头晕') || lower.includes('头痛') || lower.includes('眩')) {
      analysis += `• 头晕需鉴别中枢性（脑血管病）与周围性（耳石症、前庭神经炎）\n`;
      analysis += `• 如伴肢体无力、言语障碍、视物模糊，需紧急排除脑卒中\n`;
    }
    if (lower.includes('记忆') || lower.includes('忘') || lower.includes('认知')) {
      analysis += `• 记忆力下降需评估认知功能（建议使用系统「认知筛查」模块）\n`;
      analysis += `• 早期干预（认知训练、运动、社交）可延缓认知下降\n`;
    }
    analysis += `• 关注睡眠质量对神经系统的影响\n\n`;
  }

  if (spec.includes('肾内')) {
    analysis += `【肾内科视角】\n`;
    analysis += `• 建议监测血肌酐、尿素氮、尿微量白蛋白/肌酐比值\n`;
    analysis += `• 如合并高血压/糖尿病，注意肾脏保护（ACEI/ARB类药物）\n`;
    analysis += `• 老年患者注意药物性肾损伤风险（NSAIDs、某些抗生素）\n\n`;
  }

  if (spec.includes('呼吸')) {
    analysis += `【呼吸科视角】\n`;
    if (lower.includes('咳嗽') || lower.includes('痰') || lower.includes('喘') || lower.includes('呼吸困难')) {
      analysis += `• 需考虑感染性咳嗽、咳嗽变异性哮喘、COPD等可能\n`;
      analysis += `• 如伴发热，建议行血常规+CRP、胸部影像学检查\n`;
    }
    analysis += `• 老年人注意接种流感疫苗和肺炎疫苗\n\n`;
  }

  if (spec.includes('老年')) {
    analysis += `【老年科视角】\n`;
    analysis += `• 建议进行老年综合评估（CGA），系统评估功能状态、认知、营养、跌倒风险\n`;
    analysis += `• 注意多重用药（≥5种药物）的药物管理，定期审核用药方案\n`;
    analysis += `• 关注老年综合征：跌倒、失禁、认知下降、营养不良、衰弱\n\n`;
  }

  if (spec.includes('骨科') || spec.includes('风湿')) {
    analysis += `【${spec}视角】\n`;
    if (lower.includes('关节') || lower.includes('痛') || lower.includes('酸')) {
      analysis += `• 需评估是否为骨关节炎、类风湿关节炎、痛风性关节炎等\n`;
      analysis += `• 建议行相关关节影像学检查和风湿免疫指标筛查\n`;
    }
    analysis += `• 老年人注意骨质疏松筛查和跌倒预防\n\n`;
  }

  // Generic fallback for specialties without specific analysis
  if (!analysis) {
    analysis = `【${spec}视角】\n`;
    analysis += `• 请结合临床表现和体征综合评估\n`;
    analysis += `• 建议完善专科相关检查\n`;
    analysis += `• 如有需要，可转诊至${spec}门诊进一步诊治\n\n`;
  }

  return analysis;
}

router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const consultations = db.prepare(
      'SELECT * FROM specialist_consultations WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    res.json(consultations);
  } catch (err) { next(err); }
});

// Get single consultation
router.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const consultation = db.prepare('SELECT * FROM specialist_consultations WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!consultation) throw AppError.notFound('咨询记录');
    res.json(consultation);
  } catch (err) { next(err); }
});

export default router;
