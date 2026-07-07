import fs from 'fs';
import path from 'path';
import { getDb } from '../database.js';

function buildExtractionPrompt(reportType) {
  if (reportType === 'biochemical') {
    return `请详细识别这张医疗检验报告单中的所有信息，包括：

1. 医院/检验机构名称
2. 检验项目和结果：检验项目名称、检验数值、单位、参考范围（最小值和最大值）、异常标识

请严格按以下 JSON 格式返回（只返回 JSON，不要其他文字）：
{
  "hospital": "医院名称",
  "indicators": [
    {
      "name": "检验项目名称",
      "value": 数值,
      "unit": "单位",
      "min_ref": 参考最小值或null,
      "max_ref": 参考最大值或null,
      "is_abnormal": true/false,
      "direction": "high"或"low"或null
    }
  ]
}`;
  }
  return `请详细识别这张影像检查报告的所有内容，包括：检查日期、医院名称、检查类型、检查部位、检查所见/描述、检查结论/诊断意见。

请严格按以下 JSON 格式返回（只返回 JSON，不要其他文字）：
{
  "hospital": "医院名称",
  "date": "YYYY-MM-DD",
  "modality": "CT",
  "findings": [
    { "body_part": "检查部位", "finding": "详细描述", "impression": "诊断结论" }
  ]
}`;
}

function parseExtractionResult(reportType, rawResponse) {
  try {
    let json = rawResponse;
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) json = jsonMatch[0];
    const data = JSON.parse(json);

    if (reportType === 'biochemical') {
      return {
        hospital: data.hospital || null,
        indicators: (data.indicators || []).map(ind => ({
          indicator_name: ind.name || ind.indicator_name,
          indicator_code: inferIndicatorCode(ind.name || ind.indicator_name),
          value: parseFloat(ind.value) || 0,
          unit: ind.unit || null,
          reference_range_low: ind.min_ref != null ? parseFloat(ind.min_ref) : null,
          reference_range_high: ind.max_ref != null ? parseFloat(ind.max_ref) : null,
          reference_range_text: ind.ref_text || null,
          is_abnormal: ind.is_abnormal ? 1 : 0,
          abnormality_direction: ind.direction || null
        }))
      };
    }
    return {
      hospital: data.hospital || null,
      findings: (data.findings || []).map(f => ({
        body_part: f.body_part || '未指定',
        modality: data.modality || 'other',
        finding: f.finding || f.description || '',
        impression: f.impression || null
      }))
    };
  } catch (e) {
    console.error('[AI] Failed to parse extraction result:', e.message);
    return null;
  }
}

function inferIndicatorCode(name) {
  const map = {
    '白细胞': 'WBC', '白细胞计数': 'WBC', '红细胞': 'RBC', '红细胞计数': 'RBC',
    '血红蛋白': 'HGB', '血小板': 'PLT', '血小板计数': 'PLT',
    '血糖': 'GLU', '空腹血糖': 'GLU', '葡萄糖': 'GLU',
    '糖化血红蛋白': 'HbA1c',
    '谷丙转氨酶': 'ALT', '丙氨酸氨基转移酶': 'ALT',
    '谷草转氨酶': 'AST', '天门冬氨酸氨基转移酶': 'AST',
    '肌酐': 'CREA', '血肌酐': 'CREA', '尿素': 'BUN', '尿素氮': 'BUN',
    '尿酸': 'UA', '血尿酸': 'UA', '总胆固醇': 'TC', '胆固醇': 'TC',
    '甘油三酯': 'TG', '高密度脂蛋白': 'HDL', '低密度脂蛋白': 'LDL',
    '总蛋白': 'TP', '白蛋白': 'ALB', '总胆红素': 'TBIL',
    '碱性磷酸酶': 'ALP', 'γ-谷氨酰转移酶': 'GGT',
  };
  for (const [key, code] of Object.entries(map)) {
    if (name && name.includes(key)) return code;
  }
  return null;
}

// ── Multi-provider API call ──

async function callAnthropicAPI(base64Image, mimeType, prompt, apiKey, baseUrl, model) {
  const url = `${baseUrl}/v1/messages`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Anthropic API error ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const result = await resp.json();
  return result.content?.find(c => c.type === 'text')?.text
    || result.content?.[0]?.text
    || result.choices?.[0]?.message?.content || '';
}

async function callGLMAPI(base64Image, mimeType, prompt, apiKey, baseUrl, model) {
  const url = baseUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  const dataUrl = `data:${mimeType};base64,${base64Image}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'glm-4v',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: prompt }
        ]
      }],
      max_tokens: 4096
    })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`GLM API error ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const result = await resp.json();
  return result.choices?.[0]?.message?.content || '';
}

async function callOpenAIAPI(base64Image, mimeType, prompt, apiKey, baseUrl, model) {
  const url = `${baseUrl || 'https://api.openai.com'}/v1/chat/completions`;
  const dataUrl = `data:${mimeType};base64,${base64Image}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          { type: 'text', text: prompt }
        ]
      }],
      max_tokens: 4096
    })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`OpenAI API error ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const result = await resp.json();
  return result.choices?.[0]?.message?.content || '';
}

async function callBaiduOCRAPI(base64Image, prompt, apiKey, apiUrl, model) {
  // Baidu OCR needs access_token first, or apiKey can be the access_token directly
  let accessToken = apiKey;
  // If apiKey looks like an API Key (not a token), try to get access_token
  if (apiKey.length < 70) {
    // Might be API Key + Secret Key format "apiKey:secretKey"
    const parts = apiKey.split(':');
    if (parts.length === 2) {
      try {
        const tokenResp = await fetch(
          `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${parts[0]}&client_secret=${parts[1]}`
        );
        const tokenData = await tokenResp.json();
        if (tokenData.access_token) accessToken = tokenData.access_token;
      } catch { /* use raw key as fallback */ }
    }
  }

  const url = apiUrl || `https://aip.baidubce.com/rest/2.0/ocr/v1/general?access_token=${accessToken}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `image=${encodeURIComponent(base64Image)}&detect_direction=true&paragraph=true`
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Baidu OCR error ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const result = await resp.json();
  if (result.error_code) {
    throw new Error(`Baidu OCR error ${result.error_code}: ${result.error_msg}`);
  }
  // Baidu returns structured OCR text, format it back to our expected format
  const words = (result.words_result || []).map(w => w.words).join('\n');
  return words;
}

// Workaround for Baidu OCR: convert OCR text to structured format via text-only LLM call
async function structureOCRText(rawText, reportType, apiKey, baseUrl, model, provider) {
  const structPrompt = `以下是从医疗检验报告上 OCR 识别出的文字。请将其解析为结构化 JSON。\n\n原始文字：\n${rawText}\n\n${buildExtractionPrompt(reportType).split('请严格按以下 JSON 格式返回')[0]}\n请严格按以下 JSON 格式返回（只返回 JSON）：\n${buildExtractionPrompt(reportType).split('请严格按以下 JSON 格式返回')[1]}`;

  // Use an LLM provider to structure the text
  // Try the same provider if it supports text, fall back to Anthropic config
  try {
    const db = getDb();
    const user = db.prepare('SELECT api_key_encrypted FROM users WHERE id = 1').get();
    if (user?.api_key_encrypted) {
      const mainApiKey = Buffer.from(user.api_key_encrypted, 'base64').toString('utf-8');
      const modelCfg = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'anthropic_model'").get();
      const baseUrlCfg = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'anthropic_base_url'").get();
      const mainModel = modelCfg?.config_value || 'claude-sonnet-5';
      const mainBaseUrl = baseUrlCfg?.config_value || 'https://api.anthropic.com';

      const url = `${mainBaseUrl}/v1/messages`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': mainApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: mainModel,
          max_tokens: 4096,
          messages: [{ role: 'user', content: structPrompt }]
        })
      });
      if (resp.ok) {
        const result = await resp.json();
        return result.content?.find(c => c.type === 'text')?.text
          || result.content?.[0]?.text || '';
      }
    }
  } catch {}
  return rawText;
}

// ── Main extraction function ──

export async function performAIExtraction(imagePath, reportType, reportId, userId) {
  const db = getDb();

  try {
    // Read image
    const absPath = path.resolve(imagePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Image not found: ${absPath}`);
    }
    const imageBuffer = fs.readFileSync(absPath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = absPath.endsWith('.pdf') ? 'application/pdf' :
                     absPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    db.prepare("UPDATE health_reports SET status = 'ai_processing' WHERE id = ?").run(reportId);

    // Determine which provider to use
    const ocrProvider = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'ocr_provider'").get();
    const provider = ocrProvider?.config_value || 'anthropic';

    let rawContent;

    if (provider === 'anthropic') {
      // Use main Anthropic API config
      const user = db.prepare('SELECT api_key_encrypted FROM users WHERE id = ?').get(userId);
      if (!user?.api_key_encrypted) {
        throw new Error('未配置 API Key，请在设置页面配置 AI API Key');
      }
      const apiKey = Buffer.from(user.api_key_encrypted, 'base64').toString('utf-8');
      const modelCfg = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'anthropic_model'").get();
      const baseUrlCfg = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'anthropic_base_url'").get();
      const model = modelCfg?.config_value || 'claude-sonnet-5';
      const baseUrl = baseUrlCfg?.config_value || 'https://api.anthropic.com';

      const prompt = buildExtractionPrompt(reportType);
      rawContent = await callAnthropicAPI(base64Image, mimeType, prompt, apiKey, baseUrl, model);

    } else {
      // Use OCR-specific config
      const ocrKey = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'ocr_api_key'").get();
      const ocrUrl = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'ocr_api_url'").get();
      const ocrModel = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'ocr_model'").get();

      if (!ocrKey?.config_value) {
        throw new Error(`OCR 提供商 "${provider}" 已配置但缺少 API Key，请在设置页面配置 OCR API Key`);
      }

      const apiKey = Buffer.from(ocrKey.config_value, 'base64').toString('utf-8');
      const apiUrl = ocrUrl?.config_value || '';
      const model = ocrModel?.config_value || '';

      const prompt = buildExtractionPrompt(reportType);

      switch (provider) {
        case 'openai':
          rawContent = await callOpenAIAPI(base64Image, mimeType, prompt, apiKey, apiUrl, model);
          break;
        case 'baidu':
          rawContent = await callBaiduOCRAPI(base64Image, prompt, apiKey, apiUrl, model);
          // Baidu returns raw text, need to structure it
          rawContent = await structureOCRText(rawContent, reportType, apiKey, apiUrl, model, provider);
          break;
        case 'glm':
        case 'custom':
        default:
          rawContent = await callGLMAPI(base64Image, mimeType, prompt, apiKey, apiUrl, model);
          break;
      }
    }

    console.log(`[AI] Using provider: ${provider}, response length: ${rawContent?.length || 0}`);

    // Parse result
    const extracted = parseExtractionResult(reportType, rawContent);
    if (!extracted) {
      throw new Error('Failed to parse AI response');
    }

    // Store in database
    if (reportType === 'biochemical' && extracted.indicators?.length) {
      const insertInd = db.prepare(
        `INSERT INTO biochemical_indicators (report_id, indicator_name, indicator_code, value, unit, reference_range_low, reference_range_high, reference_range_text, is_abnormal, abnormality_direction)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const ind of extracted.indicators) {
        insertInd.run(reportId, ind.indicator_name, ind.indicator_code, ind.value, ind.unit,
          ind.reference_range_low, ind.reference_range_high, ind.reference_range_text,
          ind.is_abnormal, ind.abnormality_direction);
      }
    } else if (reportType === 'imaging' && extracted.findings?.length) {
      const insertFind = db.prepare(
        'INSERT INTO imaging_findings (report_id, body_part, modality, finding, impression) VALUES (?, ?, ?, ?, ?)'
      );
      for (const f of extracted.findings) {
        insertFind.run(reportId, f.body_part, f.modality, f.finding, f.impression);
      }
    }

    if (extracted.hospital) {
      db.prepare('UPDATE health_reports SET hospital_name = COALESCE(NULLIF(?, ""), hospital_name) WHERE id = ?')
        .run(extracted.hospital, reportId);
    }
    db.prepare("UPDATE health_reports SET ai_processed = 1, status = 'processed' WHERE id = ?").run(reportId);
    console.log(`[AI] Extraction complete for report #${reportId}: ${extracted.indicators?.length || extracted.findings?.length || 0} items`);

  } catch (err) {
    console.error('[AI] Extraction failed for report #' + reportId + ':', err.message);
    db.prepare("UPDATE health_reports SET status = 'failed' WHERE id = ?").run(reportId);
  }
}
