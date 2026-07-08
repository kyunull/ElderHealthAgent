import { Router } from 'express';
import { getDb } from '../database.js';
import { AppError } from '../middleware/error-handler.js';
import { searchKnowledgeBase } from '../services/knowledge-base.js';

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

    db.prepare("UPDATE specialist_consultations SET status = 'processing' WHERE id = ?").run(consultation.id);

    const specialtyLabel = consultation.mdt_specialties
      ? JSON.parse(consultation.mdt_specialties).map(s => SPECIALTY_NAMES[s] || s).join('、')
      : (SPECIALTY_NAMES[consultation.specialty] || consultation.specialty);

    let analysis;
    try {
      analysis = await callAIForConsultation(consultation, specialtyLabel, req.user.id);
    } catch (aiErr) {
      console.error('[Consultation] AI call failed:', aiErr.message);
      analysis = generateAnalysis(consultation.chief_complaint, specialtyLabel, consultation.consultation_type);
    }

    db.prepare("UPDATE specialist_consultations SET status = 'completed', ai_response = ? WHERE id = ?")
      .run(analysis, consultation.id);

    res.json({ status: 'completed', message: '分析完成' });
  } catch (err) { next(err); }
});

// Follow-up Q&A — multi-round conversation
router.post('/:id/follow-up', async (req, res, next) => {
  try {
    const db = getDb();
    const consultation = db.prepare('SELECT * FROM specialist_consultations WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!consultation) throw AppError.notFound('咨询记录');
    if (!consultation.ai_response) throw AppError.validation({ consultation: '请先完成初次分析' });

    const { question, conversation_history } = req.body;
    if (!question) throw AppError.validation({ question: '请输入您的问题' });

    // Build conversation context from history
    const history = Array.isArray(conversation_history) ? conversation_history : [];
    const knowledgeEntries = searchKnowledgeBase(consultation.chief_complaint + ' ' + question);

    const response = await callAIForFollowUp(consultation, question, history, knowledgeEntries, req.user.id);

    res.json({ response, knowledge_used: knowledgeEntries.map(e => e.disease).join('、') });
  } catch (err) { next(err); }
});

// Real AI API call for follow-up Q&A
async function callAIForFollowUp(consultation, question, history, knowledgeEntries, userId) {
  const db = getDb();
  const user = db.prepare('SELECT api_key_encrypted FROM users WHERE id = ?').get(userId);
  if (!user?.api_key_encrypted) throw new Error('未配置 AI API Key');

  const apiKey = Buffer.from(user.api_key_encrypted, 'base64').toString('utf-8');
  const modelCfg = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'anthropic_model'").get();
  const baseUrlCfg = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'anthropic_base_url'").get();
  const model = modelCfg?.config_value || 'claude-sonnet-5';
  const baseUrl = baseUrlCfg?.config_value || 'https://api.anthropic.com';

  const specialtyLabel = consultation.mdt_specialties
    ? JSON.parse(consultation.mdt_specialties).map(s => SPECIALTY_NAMES[s] || s).join('、')
    : (SPECIALTY_NAMES[consultation.specialty] || consultation.specialty);

  // Build knowledge context
  let knowledgeContext = '';
  if (knowledgeEntries.length > 0) {
    knowledgeContext = `【健康知识参考】\n${knowledgeEntries.map(e => e.content).join('\n\n')}`;
  }

  // Build conversation history context
  let historyContext = '';
  if (history.length > 0) {
    historyContext = '【对话历史】\n' + history.map(h =>
      `${h.role === 'user' ? '用户' : 'AI助手'}：${h.content}`
    ).join('\n') + '\n';
  }

  const prompt = `你是一位在颐年家庭医生平台上工作的亲切、有同理心的健康顾问。你不是医生，不能做诊断或开药——你的角色是用温暖易懂的语言帮助老人理解健康问题，并提供生活方式方面的初步建议。

${knowledgeContext}

${historyContext}

【当前提问】
${question}

【患者背景信息】
主诉：${consultation.chief_complaint}
涉及专科：${specialtyLabel}

请以朋友般的语气回复，遵循以下原则：

1. 使用亲切、通俗的语言，像长辈身边关心他的人一样说话。避免堆砌医学术语，必要时用比喻解释。
2. 根据情况主动追问关键信息（如：血压高了就问"今天吃降压药了吗？有没有头晕的感觉？"），每次回复最多追问2-3个问题。
3. 结合上面提供的健康知识，给出实用的生活调整建议。
4. 严格禁止以下行为，否则会伤害用户：
   ❌ 不要直接说"你得的是什么什么病"或给出确诊判断
   ❌ 不要写"建议服用XX药"或调整药物剂量——这是医生的职责
   ❌ 不要建议做有创或有风险的检查
   ✅ 只做初步分诊参考和生活习惯建议，引导就医

回复格式：
- 先表达理解和共情
- 再给出生活建议和需要关注的点
- 最后自然追问（如需要）
- 如需进一步诊疗，温和建议去医院挂${specialtyLabel.split('、')[0]}`;

  const resp = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`AI API error ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const result = await resp.json();
  return result.content?.find(c => c.type === 'text')?.text
    || result.content?.[0]?.text
    || result.choices?.[0]?.message?.content || '';
}

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
  const knowledgeEntries = searchKnowledgeBase(consultation.chief_complaint);

  let knowledgeContext = '';
  if (knowledgeEntries.length > 0) {
    knowledgeContext = `【慢病管理知识库（经检索匹配）】\n${knowledgeEntries.map(e => e.content).join('\n\n')}`;
  }

  const prompt = `你是一位在颐年家庭医生平台上工作的亲切、温暖的健康顾问（不是医生）。你的服务对象主要是老年人，请用他们能听懂的话来交流。

【任务】
基于用户的健康信息，生成一份温暖易懂的初步分析，帮助用户了解自己的身体状况，并给出实用的生活建议。

【咨询类型】${consultType}
【涉及专科】${specialtyLabel}
【用户主诉及补充信息】
${consultation.chief_complaint}

${knowledgeContext}

【重要——你必须遵守以下原则】
1. 🫂 同理心优先：语气要亲切自然，像关心长辈一样。使用"您"、"咱们"等称谓。语言通俗，避免专业术语堆砌，用日常生活中的比喻来解释。
2. 🔄 多轮追问：分析中请包含2-4个追问，引导用户补充关键信息。例如检测到血压升高时主动问："您今天吃降压药了吗？平时在家量血压是多少呀？有没有头晕的感觉？"
3. 🛡️ 安全边界（极其重要——AI伤害用户是不可接受的）：
   ❌ 严禁给出确定性的诊断结论（不要说"您得了XX病"）
   ❌ 严禁直接推荐药品、建议服药、调整药物剂量
   ❌ 严禁建议任何有创操作或高风险检查
   ✅ 只能做：初步分诊方向、生活方式调整建议、建议就医科室
4. 📚 结合知识库：参考上面提供的慢病管理知识，给出有依据的生活建议，不确定的事情诚实说"这需要医生结合检查来判断"。

【回复格式】
请按以下结构回复（使用中文，语言亲切）：

💬 理解您的感受
（一两句话，表达对用户情况的理解和关心，让用户感到被倾听）

📋 初步分析参考
（从${specialtyLabel}的角度，用通俗语言说说这些症状可能和什么有关。注意这不是诊断，只是帮用户了解大概方向。每个专科视角1-2段即可）

🌿 日常可以试试这样做
（具体、安全的生活建议：饮食怎么调整、什么活动适合、作息怎么安排。来自知识库的建议优先）

🔍 还想多了解您的情况（追问环节）
（提2-4个具体问题来获取更多关键信息，帮助更准确地分诊。问题要亲切自然、不带压力）

🏥 什么时候该去看医生
（什么情况下建议就诊、挂哪个科室、就诊前准备什么）

⚠️ 重要提醒
郑重提醒：本分析由AI生成，仅供参考，不能替代医生诊断。如有紧急情况（剧烈胸痛、呼吸困难、意识改变等），请立即拨打120。`;

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

// Fallback analysis when AI is unavailable
function generateAnalysis(complaint, specialty, type) {
  const shortComplaint = complaint.length > 200 ? complaint.slice(0, 200) + '...' : complaint;
  const knowledgeEntries = searchKnowledgeBase(complaint);

  let report = '';
  report += `💬 理解您的感受\n\n`;
  report += `感谢您的信任，把身体的情况告诉我们。您提到的这些情况确实需要重视，咱们一起来看看是怎么回事。\n\n`;

  report += `📋 初步分析参考\n\n`;
  report += `根据您描述的情况（${shortComplaint}），从${specialty}角度看，这些症状可能涉及几个方向。需要说明的是，这不是诊断结论，只是帮您了解大概方向，最终还需要医生面诊来确定。\n\n`;

  if (knowledgeEntries.length > 0) {
    report += `🌿 日常可以试试这样做\n\n`;
    for (const entry of knowledgeEntries) {
      report += entry.content + '\n\n';
    }
  } else {
    report += `🌿 日常可以试试这样做\n\n`;
    report += `• 保持规律作息，避免劳累和情绪波动\n`;
    report += `• 记录症状变化（什么情况下加重、什么情况下缓解），就诊时带给医生\n`;
    report += `• 饮食清淡，减少盐和高脂肪食物\n`;
    report += `• 适度活动，以不引起不适为度\n\n`;
  }

  report += `🔍 还想多了解您的情况\n\n`;
  report += generateFollowUpQuestions(complaint, specialty);

  report += `\n🏥 什么时候该去看医生\n\n`;
  report += `• 如果症状持续不缓解或进行性加重，建议去「${specialty.split('、')[0]}」就诊\n`;
  report += `• 就诊前准备好：近期检查报告、正在服用的药品清单、症状变化日记\n`;
  report += `• 如出现紧急情况（剧烈疼痛、呼吸困难、意识改变），请立即拨打120\n\n`;

  report += `⚠️ 重要提醒\n`;
  report += `本分析由AI自动生成，仅供健康知识参考，不能替代医生面诊。所有诊疗决策请咨询专业医生。\n`;

  return report;
}

function generateFollowUpQuestions(complaint, specialty) {
  const lower = complaint.toLowerCase();
  const questions = [];

  if (lower.includes('血压') || lower.includes('头晕') || lower.includes('高压')) {
    questions.push('您今天量过血压了吗？数值是多少呢？');
    questions.push('降压药今天按时吃了吗？');
  }
  if (lower.includes('血糖') || lower.includes('糖尿') || lower.includes('糖')) {
    questions.push('最近一次测血糖是什么时候？空腹和饭后大概是多少呢？');
    questions.push('今天三餐都正常吃了吗？有没有按时吃降糖药？');
  }
  if (lower.includes('胸') || lower.includes('闷') || lower.includes('气短')) {
    questions.push('不舒服的感觉是在什么情况下出现的？是走路快了、爬楼梯，还是安静待着也会？');
    questions.push('持续多长时间了？休息一下能缓解吗？');
  }
  if (lower.includes('关节') || lower.includes('痛') || lower.includes('酸')) {
    questions.push('疼痛是早上起床时明显，还是活动后更明显？');
    questions.push('有没有红肿发热的感觉？两边关节是不是都有感觉？');
  }
  if (lower.includes('睡') || lower.includes('失眠') || lower.includes('入睡')) {
    questions.push('晚上大概几点上床？一般多长时间才能睡着？');
    questions.push('白天会喝咖啡或茶吗？大概几点喝的呢？');
  }
  if (lower.includes('咳嗽') || lower.includes('痰') || lower.includes('喘')) {
    questions.push('咳嗽有多长时间了？痰是什么颜色的？');
    questions.push('有没有发烧？最近有没有感冒过？');
  }

  if (questions.length === 0) {
    questions.push('这些症状持续多长时间了？中间有没有好转过？');
    questions.push('您觉得什么情况下会加重？什么情况下会缓解呢？');
    questions.push('除了您说的这些，还有其他不舒服的地方吗？');
  }

  return questions.slice(0, 4).map(q => `• ${q}`).join('\n');
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
