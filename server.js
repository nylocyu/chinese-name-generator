import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const client = new Anthropic();

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                   // 10 requests per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again in an hour.' },
});

app.use('/api/', apiLimiter);

app.post('/api/generate', async (req, res) => {
  const { name, gender, soundPreference, style, region } = req.body;

  if (!name || !gender || !soundPreference || !style || !region) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 50) {
    return res.status(400).json({ success: false, error: 'Name must be 50 characters or fewer.' });
  }
  if (/^\d+$/.test(trimmedName)) {
    return res.status(400).json({ success: false, error: 'Please enter a real name, not just numbers.' });
  }
  if (!/[a-zA-Z\u00C0-\u024F]/.test(trimmedName)) {
    return res.status(400).json({ success: false, error: 'Please enter a real name.' });
  }
  if (/(.)\1{4,}/.test(trimmedName)) {
    return res.status(400).json({ success: false, error: 'Please enter a real name without excessive repeated characters.' });
  }

  const genderText =
    gender === 'male' ? 'male' : gender === 'female' ? 'female' : 'gender-neutral';
  const soundText =
    soundPreference === 'phonetic'
      ? 'phonetically similar to the original name (try to echo its sounds or rhythm in Chinese)'
      : 'independent from the original name — chosen purely for meaning and beauty';
  const styleText =
    style === 'classical'
      ? 'classical, poetic, and literary — drawing on classical Chinese literature and poetry'
      : 'modern, approachable, and everyday — a name that feels natural for contemporary life. IMPORTANT: For a modern style, the surname MUST be chosen from the 100 most common Chinese surnames (e.g. 王 李 张 刘 陈 杨 黄 赵 吴 周 徐 孙 马 朱 胡 郭 何 高 林 郑 谢 罗 梁 宋 唐 许 韩 冯 邓 曹 彭 曾 萧 田 董 袁 潘 于 蒋 蔡 余 杜 叶 程 苏 魏 吕 丁 任 卢 姚 沈 钟 姜 崔 谭 廖 范 汪 陆 金 石 戴 贾 韦 夏 邱 方 侯 邹 熊 孟 秦 白 江 阎 薛 尹 段 雷 黎 史 龙 陶 贺 顾 毛 郝 龚 邵 万 钱 严 赖 覃 洪 武 莫 孔). Exotic or rare surnames are NOT acceptable.';

  const regionText =
    region === 'taiwan'
      ? 'Taiwanese naming tradition. Use Traditional Chinese characters (繁體字) exclusively — do NOT use Simplified characters. Draw on Taiwanese cultural references, classical Chinese literary traditions as preserved in Taiwan, and naming aesthetics common in contemporary Taiwan.'
      : 'Mainland Chinese naming tradition. Use Simplified Chinese characters (简体字) exclusively — do NOT use Traditional characters. Draw on contemporary Mainland Chinese naming trends and cultural references.';

  const prompt = `You are a master Chinese naming expert with deep knowledge of Chinese linguistics, calligraphy, classical literature, and cultural traditions across both Mainland China and Taiwan.

A person named "${name}" wants a beautiful, authentic Chinese name.

Requirements:
- Gender preference: ${genderText}
- Sound: The Chinese name should be ${soundText}
- Style: ${styleText}
- Region: ${regionText}

Create a thoughtful, authentic Chinese name that feels truly Chinese — not a simple transliteration. Consider:
- The tonal qualities and melodic flow when spoken aloud
- The cultural weight, visual beauty, and associations of each character
- Classical literary references or natural imagery when using a classical style
- Contemporary wearability and naturalness when using a modern style
- The correct character set for the chosen region (this is critical)

STRICT TABOOS — Avoid these at all costs:
- Characters that are homophones of negative concepts (死 sǐ death, 病 bìng illness, 穷 qióng poverty, 苦 kǔ suffering, 败 bài failure, and similar inauspicious sounds)
- Overly rare or archaic characters that educated Chinese speakers cannot readily read
- Character combinations that create unintended words or phrases when read together (e.g. two characters whose combination means something crude or unlucky)
- Names identical or near-identical to famous Chinese celebrities, historical figures, or political leaders

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks, just raw JSON):
{
  "surname": "single Chinese surname character (use the correct script for the region)",
  "given_name": "1-2 Chinese given name characters (use the correct script for the region)",
  "full_name": "surname + given_name combined",
  "pinyin": "Full pinyin with tone marks — one syllable per character, separated by spaces (e.g., Lín Chén Xī)",
  "surname_meaning": "one short sentence (max 8 words) on what this surname means",
  "given_name_meanings": ["one short sentence (max 10 words) for the first given name character", "one short sentence (max 10 words) for the second given name character (omit this element if the given name is only 1 character)"],
  "overall_meaning": "the poetic overall meaning and feeling of the complete name in 1-2 sentences",
  "why_this_suits_you": "a personal, thoughtful 2-3 sentence explanation of why this name fits this person",
  "cultural_note": "an interesting cultural or literary context, reference, or tradition related to this name",
  "pronunciation_tip": "simple English pronunciation guide syllable by syllable (e.g., 'Lin = like lean, Chen = like chen in bench, Xi = like she')"
}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error generating name:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.post('/api/check', async (req, res) => {
  const { name, region } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Name is required' });
  }

  if (name.trim().length > 10) {
    return res.status(400).json({ success: false, error: 'Name must be 10 characters or fewer.' });
  }

  if (!/^[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u2CEB0-\u2EBEF]+$/.test(name.trim())) {
    return res.status(400).json({ success: false, error: 'Please enter Chinese characters only.' });
  }
  if (/(.)\1{3,}/.test(name.trim())) {
    return res.status(400).json({ success: false, error: 'Please enter a real Chinese name without excessive repeated characters.' });
  }

  const regionContext =
    region === 'taiwan'
      ? 'Region: Taiwan. Evaluate against Taiwanese naming conventions. Traditional Chinese characters (繁體字) are expected — flag Simplified characters as incorrect for this context. Apply Taiwanese cultural and literary standards.'
      : 'Region: Mainland China. Evaluate against Mainland Chinese naming conventions. Simplified Chinese characters (简体字) are expected — flag Traditional characters as incorrect for this context. Apply contemporary Mainland Chinese naming standards.';

  const prompt = `You are a Chinese language and naming expert with deep knowledge of linguistics, cultural history, and naming conventions across Mainland China and Taiwan.

Analyze this Chinese name: "${name}"
${regionContext}

Be honest and rigorous — this tool exists specifically to tell people whether their name is truly authentic or subtly "off."

CRITICAL checks:
- Are all characters valid and commonly readable Chinese characters?
- Does this follow real naming conventions (surname first, 1-2 char given name)?
- Does this read as a name a Chinese family would genuinely choose — or does it signal a foreigner's attempt?
- Is the character script consistent with the expected region?

Respond ONLY with valid JSON, no markdown:
{
  "is_authentic": true or false,
  "authenticity_score": 0-100,
  "score_breakdown": {
    "character_validity": 0-25,
    "naming_convention": 0-25,
    "tonal_harmony": 0-25,
    "cultural_authenticity": 0-25
  },
  "characters_analysis": [
    {
      "char": "character",
      "pinyin": "pinyin with tone mark",
      "meaning": "meaning and connotations",
      "gender_signal": "masculine / feminine / neutral"
    }
  ],
  "full_pinyin": "complete pinyin with tone marks",
  "overall_meaning": "what the name means and evokes, 1-2 sentences",
  "gender_association": "masculine / feminine / neutral / ambiguous",
  "tonal_harmony": "assessment of how the tones flow when spoken aloud",
  "foreigner_flag": true or false,
  "foreigner_signals": "specific reasons this reads as non-native, or null",
  "cultural_notes": "literary allusions, historical references, or cultural weight",
  "verdict": "2-3 sentence honest overall assessment",
  "suggestions": [
    {
      "issue": "specific problem",
      "alternative": "concrete alternative character or combination",
      "reason": "why this improves the name"
    }
  ]
}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1536,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error checking name:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.get('/chinese-name-generator', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'name-generator.html'));
});

app.get('/checker', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'checker.html'));
});

app.get('/imprint', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'imprint.html'));
});

app.get('/privacy-policy', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'privacy-policy.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Chinese Name Generator running at http://localhost:${PORT}`);
});
