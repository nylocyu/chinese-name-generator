'use strict';

const form          = document.getElementById('checker-form');
const input         = document.getElementById('checker-input');
const submitBtn     = document.getElementById('checker-submit');
const loadingEl     = document.getElementById('checker-loading');
const errorEl       = document.getElementById('checker-error');
const resultEl      = document.getElementById('checker-result');
const checkAgainBtn = document.getElementById('btn-check-again');

// Region toggle
let selectedRegion = 'mainland';
document.getElementById('checker-region-toggle').querySelectorAll('.region-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#checker-region-toggle .region-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedRegion = btn.dataset.value;
  });
});

// Result elements
const ringFill        = document.getElementById('ring-fill');
const scoreNumber     = document.getElementById('score-number');
const scoreVerdict    = document.getElementById('score-verdict');
const authBadge       = document.getElementById('auth-badge');
const genderTag       = document.getElementById('gender-tag');
const checkerChars    = document.getElementById('checker-chars');
const checkerPinyin   = document.getElementById('checker-pinyin');
const checkerMeaning  = document.getElementById('checker-meaning');
const checkerNatural  = document.getElementById('checker-naturalness');
const checkerCulture  = document.getElementById('checker-culture');
const checkerVerdict  = document.getElementById('checker-verdict');
const suggestionsWrap = document.getElementById('suggestions-wrap');
const checkerSuggests = document.getElementById('checker-suggestions');

// Circumference for r=35: 2π×35 ≈ 219.9
const CIRCUMFERENCE = 2 * Math.PI * 35;

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add('visible');
}

function clearError() {
  errorEl.textContent = '';
  errorEl.classList.remove('visible');
}

function setLoading(on) {
  if (on) {
    loadingEl.classList.add('visible');
    submitBtn.disabled = true;
    input.disabled     = true;
    resultEl.classList.add('checker-result-hidden');
    resultEl.classList.remove('checker-result');
  } else {
    loadingEl.classList.remove('visible');
    submitBtn.disabled = false;
    input.disabled     = false;
  }
}

function getAuthLabel(score, isAuthentic) {
  if (!isAuthentic || score < 40)  return { text: 'Not Authentic', cls: 'badge-inauthentic' };
  if (score < 65)                  return { text: 'Questionable',  cls: 'badge-questionable' };
  return                                  { text: 'Authentic',     cls: 'badge-authentic'    };
}

function getVerdictLabel(score) {
  if (score >= 80) return { text: 'Excellent name',    cls: 'great'      };
  if (score >= 60) return { text: 'Good name',         cls: 'good'       };
  if (score >= 40) return { text: 'Usable, with notes', cls: ''          };
  return                  { text: 'Needs revision',   cls: 'poor'        };
}

function getGenderLabel(g) {
  const map = {
    masculine:  '♂ Masculine',
    feminine:   '♀ Feminine',
    neutral:    '◯ Neutral',
    ambiguous:  '≈ Ambiguous',
    unclear:    '? Unclear',
  };
  return map[g?.toLowerCase()] || g || 'Unknown';
}

function displayResult(data) {
  const score = Math.min(100, Math.max(0, data.authenticity_score || 0));

  // Score ring
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
  ringFill.style.strokeDashoffset = CIRCUMFERENCE; // reset
  ringFill.classList.toggle('gold', score >= 70);

  setTimeout(() => {
    ringFill.style.strokeDashoffset = offset;
  }, 80);

  scoreNumber.textContent = score;

  // Verdict label
  const vInfo = getVerdictLabel(score);
  scoreVerdict.textContent = vInfo.text;
  scoreVerdict.className   = `score-verdict ${vInfo.cls}`;

  // Auth badge
  const aInfo = getAuthLabel(score, data.is_authentic);
  authBadge.textContent = aInfo.text;
  authBadge.className   = `authenticity-badge ${aInfo.cls}`;

  // Gender tag
  genderTag.textContent = getGenderLabel(data.gender_association);

  // Characters
  checkerChars.innerHTML = '';
  const chars = data.characters_analysis || [];
  chars.forEach(item => {
    const pill     = document.createElement('div');
    const charEl   = document.createElement('div');
    const infoEl   = document.createElement('div');
    const pinyinEl = document.createElement('div');
    const meaningEl = document.createElement('div');

    pill.className     = 'char-pill';
    charEl.className   = 'char-pill-char';
    infoEl.className   = 'char-pill-info';
    pinyinEl.className = 'char-pill-pinyin';
    meaningEl.className = 'char-pill-meaning';

    charEl.textContent   = item.char    || '';
    pinyinEl.textContent = item.pinyin  || '';
    meaningEl.textContent = truncate(item.meaning || '', 70);

    infoEl.appendChild(pinyinEl);
    infoEl.appendChild(meaningEl);
    pill.appendChild(charEl);
    pill.appendChild(infoEl);
    checkerChars.appendChild(pill);
  });

  checkerPinyin.textContent  = data.full_pinyin     || '';
  checkerMeaning.textContent = data.overall_meaning || '';
  checkerNatural.textContent = data.tonal_harmony   || '';
  checkerCulture.textContent = data.cultural_notes  || '';
  checkerVerdict.textContent = data.verdict         || '';

  // Foreigner flag
  const foreignWrap    = document.getElementById('foreigner-wrap');
  const foreignSignals = document.getElementById('checker-foreigner-signals');
  if (data.foreigner_flag) {
    foreignSignals.textContent = data.foreigner_signals || '';
    foreignWrap.style.display = 'block';
  } else {
    foreignWrap.style.display = 'none';
  }

  // Score breakdown
  const sb = data.score_breakdown || {};
  document.getElementById('sb-char-validity').textContent    = sb.character_validity   ?? '—';
  document.getElementById('sb-naming-convention').textContent = sb.naming_convention   ?? '—';
  document.getElementById('sb-tonal-harmony').textContent    = sb.tonal_harmony        ?? '—';
  document.getElementById('sb-cultural-auth').textContent    = sb.cultural_authenticity ?? '—';

  // Suggestions (array)
  if (Array.isArray(data.suggestions) && data.suggestions.length) {
    checkerSuggests.innerHTML = '';
    data.suggestions.forEach(s => {
      const item    = document.createElement('div');
      const issue   = document.createElement('strong');
      const reason  = document.createElement('div');
      item.className = 'suggestion-item';
      issue.textContent  = s.issue  || '';
      reason.textContent = s.reason || '';
      item.appendChild(issue);
      if (s.alternative) {
        const alt = document.createElement('span');
        alt.className   = 'suggestion-alt';
        alt.textContent = s.alternative;
        item.appendChild(alt);
      }
      item.appendChild(reason);
      checkerSuggests.appendChild(item);
    });
    suggestionsWrap.style.display = 'block';
  } else {
    suggestionsWrap.style.display = 'none';
  }

  // Reveal result
  resultEl.classList.remove('checker-result-hidden');
  resultEl.classList.add('checker-result');

  // Scroll to result
  setTimeout(() => {
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

async function runCheck(nameInput) {
  clearError();
  setLoading(true);

  let accumulated = '';
  let streamStarted = false;
  const loadingText = loadingEl.querySelector('.loading-text');

  try {
    const res = await fetch('/api/check', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: nameInput, region: selectedRegion }),
    });

    // Validation errors return JSON before SSE headers are set
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || 'Something went wrong.');
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep any incomplete line for next iteration

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break outer;

        let parsed;
        try { parsed = JSON.parse(payload); } catch { continue; }
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.text) {
          accumulated += parsed.text;
          if (!streamStarted) {
            streamStarted = true;
            if (loadingText) loadingText.innerHTML = 'Receiving<span class="loading-dots"></span>';
          }
        }
      }
    }

    const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid response format');
    displayResult(JSON.parse(jsonMatch[0]));
  } catch (err) {
    showError('Error: ' + err.message + '. Please check your API key and try again.');
  } finally {
    if (loadingText) loadingText.innerHTML = 'Analysing<span class="loading-dots"></span>';
    setLoading(false);
  }
}

// Chinese character range filter
const CHINESE_RE = /[^\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u2CEB0-\u2EBEF]/g;

function stripNonChinese(str) {
  return str.replace(CHINESE_RE, '');
}

input.addEventListener('input', () => {
  const cleaned = stripNonChinese(input.value);
  if (cleaned !== input.value) input.value = cleaned;
});

input.addEventListener('paste', e => {
  e.preventDefault();
  const pasted  = e.clipboardData.getData('text');
  const cleaned = stripNonChinese(pasted);
  const start   = input.selectionStart;
  const end     = input.selectionEnd;
  const current = input.value;
  input.value   = (current.slice(0, start) + cleaned + current.slice(end)).slice(0, 10);
  input.setSelectionRange(start + cleaned.length, start + cleaned.length);
});

form.addEventListener('submit', e => {
  e.preventDefault();
  const val = input.value.trim();
  if (!val) return;
  runCheck(val);
});

checkAgainBtn.addEventListener('click', () => {
  resultEl.classList.add('checker-result-hidden');
  resultEl.classList.remove('checker-result');
  input.value = '';
  input.focus();
  clearError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function truncate(str, max) {
  if (!str || str.length <= max) return str;
  return str.slice(0, max) + '…';
}

// Auto-focus
setTimeout(() => input.focus(), 300);
