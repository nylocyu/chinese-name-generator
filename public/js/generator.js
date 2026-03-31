'use strict';

// ── State ────────────────────────────────────────────────
const state = {
  currentStep: 1,
  totalSteps: 4,
  answers: {
    name: '',
    gender: '',
    sound: '',
    style: '',
    region: 'mainland',
  },
};

// ── DOM refs ─────────────────────────────────────────────
const quizSection    = document.getElementById('quiz-section');
const resultSection  = document.getElementById('result-section');
const stepsContainer = document.getElementById('steps-container');
const progressFill   = document.getElementById('progress-fill');
const stepCurrent    = document.getElementById('step-current');
const stepTotal      = document.getElementById('step-total');
const btnBack        = document.getElementById('btn-back');
const btnNext        = document.getElementById('btn-next');
const stepNav        = document.getElementById('step-nav');
const loadingState   = document.getElementById('loading-state');
const errorBox       = document.getElementById('error-box');

// Result DOM
const resultNameDisplay = document.getElementById('result-name-display');
const resultCharacters  = document.getElementById('result-characters');
const resultPinyin      = document.getElementById('result-pinyin');
const charBreakdown     = document.getElementById('char-breakdown');
const resultMeaning     = document.getElementById('result-meaning');
const resultWhy         = document.getElementById('result-why');
const resultCulture     = document.getElementById('result-culture');
const resultPronun      = document.getElementById('result-pronunciation');
const btnRestart        = document.getElementById('btn-restart');

// ── Helpers ──────────────────────────────────────────────
function updateProgress() {
  const pct = ((state.currentStep - 1) / state.totalSteps) * 100;
  progressFill.style.width = pct + '%';
  stepCurrent.textContent = state.currentStep;
  stepTotal.textContent   = state.totalSteps;
}

function updateNextButton() {
  const step = state.currentStep;
  let enabled = false;

  if (step === 1) enabled = state.answers.name.trim().length > 0;
  if (step === 2) enabled = !!state.answers.gender;
  if (step === 3) enabled = !!state.answers.sound;
  if (step === 4) enabled = !!state.answers.style;

  btnNext.disabled = !enabled;

  if (step === 4 && enabled) {
    btnNext.innerHTML = `
      Generate My Name
      <svg class="btn-arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4 10h12M11 5l5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
  } else {
    btnNext.innerHTML = `
      Continue
      <svg class="btn-arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4 10h12M11 5l5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
  }
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add('visible');
}

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.remove('visible');
}

// ── Step transitions ─────────────────────────────────────
function goToStep(next) {
  const prevEl = document.getElementById(`step-${state.currentStep}`);
  const nextEl = document.getElementById(`step-${next}`);
  if (!nextEl) return;

  prevEl.classList.add('exiting');
  prevEl.classList.remove('active');

  setTimeout(() => {
    prevEl.classList.remove('exiting');
  }, 420);

  nextEl.style.transform = 'translateX(32px)';
  nextEl.style.opacity   = '0';
  nextEl.classList.add('active');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      nextEl.style.transform = '';
      nextEl.style.opacity   = '';
    });
  });

  state.currentStep = next;
  updateProgress();
  updateNextButton();

  btnBack.style.visibility = state.currentStep > 1 ? 'visible' : 'hidden';

  // Focus input on step 1 if going back
  if (next === 1) {
    setTimeout(() => document.getElementById('input-name').focus(), 450);
  }
}

// ── Region toggle ────────────────────────────────────────
document.getElementById('region-toggle').querySelectorAll('.region-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.answers.region = btn.dataset.value;
  });
});

// ── Option cards ─────────────────────────────────────────
function setupOptionGroup(containerId, answerKey) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.answers[answerKey] = card.dataset.value;
      updateNextButton();
    });
  });
}

// ── Name input ───────────────────────────────────────────
document.getElementById('input-name').addEventListener('input', e => {
  state.answers.name = e.target.value;
  updateNextButton();
});

document.getElementById('input-name').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !btnNext.disabled) btnNext.click();
});

// ── Navigation ───────────────────────────────────────────
btnNext.addEventListener('click', () => {
  clearError();
  if (state.currentStep < state.totalSteps) {
    goToStep(state.currentStep + 1);
  } else {
    submitForm();
  }
});

btnBack.addEventListener('click', () => {
  if (state.currentStep > 1) goToStep(state.currentStep - 1);
});

btnRestart.addEventListener('click', resetQuiz);

// ── Submit ───────────────────────────────────────────────
async function submitForm() {
  clearError();

  // Hide quiz content, show loading
  stepsContainer.style.display = 'none';
  stepNav.style.display         = 'none';
  document.querySelector('.quiz-meta').style.display = 'none';
  loadingState.classList.add('visible');

  progressFill.style.width = '100%';

  let accumulated = '';

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:            state.answers.name,
        gender:          state.answers.gender,
        soundPreference: state.answers.sound,
        style:           state.answers.style,
        region:          state.answers.region,
      }),
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
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break outer;

        let parsed;
        try { parsed = JSON.parse(payload); } catch { continue; }
        if (parsed.error) {
          const errMsg = typeof parsed.error === 'object'
            ? (parsed.error.message || 'Unknown error')
            : parsed.error;
          const isOverloaded = typeof parsed.error === 'object' && parsed.error.type === 'overloaded_error';
          throw new Error(isOverloaded ? 'The AI service is temporarily overloaded. Please try again in a moment.' : errMsg);
        }
        if (parsed.text) accumulated += parsed.text;
      }
    }

    const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid response format');
    displayResult(JSON.parse(jsonMatch[0]));
  } catch (err) {
    // Restore quiz UI on error
    stepsContainer.style.display = '';
    stepNav.style.display         = '';
    document.querySelector('.quiz-meta').style.display = '';
    loadingState.classList.remove('visible');
    progressFill.style.width = '75%';
    showError(err.message || 'Something went wrong. Please try again.');
  }
}

// ── Display result ────────────────────────────────────────
function displayResult(data) {
  // Hide quiz
  quizSection.classList.add('hidden');
  loadingState.classList.remove('visible');

  // Populate result
  resultCharacters.textContent = data.full_name || '';
  resultPinyin.textContent     = data.pinyin    || '';
  resultNameDisplay.setAttribute('data-char', data.given_name || '');

  // Character breakdown
  charBreakdown.innerHTML = '';
  const parts = [];

  if (data.surname) {
    parts.push({
      char:    data.surname,
      pinyin:  extractPinyinPart(data.pinyin, 0),
      meaning: data.surname_meaning || '',
      label:   'Surname',
    });
  }

  // Given name characters
  const givenChars = data.given_name ? [...data.given_name] : [];
  givenChars.forEach((char, i) => {
    parts.push({
      char,
      pinyin:  extractPinyinPart(data.pinyin, i + 1),
      meaning: (data.given_name_meanings && data.given_name_meanings[i]) || data.given_name_meaning || '',
      label:   givenChars.length > 1 ? `Given ${i + 1}` : 'Given Name',
    });
  });

  parts.forEach(part => {
    const pill = document.createElement('div');
    pill.className = 'char-pill';
    pill.innerHTML = `
      <div class="char-pill-char">${part.char}</div>
      <div class="char-pill-info">
        <div class="char-pill-pinyin">${part.pinyin}</div>
        <div class="char-pill-meaning">${part.meaning}</div>
      </div>
    `;
    charBreakdown.appendChild(pill);
  });

  resultMeaning.textContent   = data.overall_meaning  || '';
  resultWhy.textContent       = data.why_this_suits_you || '';
  resultCulture.textContent   = data.cultural_note    || '';
  resultPronun.textContent    = data.pronunciation_tip || '';

  // Show result
  resultSection.classList.add('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Reset ─────────────────────────────────────────────────
function resetQuiz() {
  // Reset state
  state.currentStep    = 1;
  state.answers.name   = '';
  state.answers.gender = '';
  state.answers.sound  = '';
  state.answers.style  = '';
  state.answers.region = 'mainland';

  // Clear inputs/selections
  document.getElementById('input-name').value = '';
  document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));

  // Reset region toggle
  document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.region-btn[data-value="mainland"]').classList.add('active');

  // Restore quiz UI
  stepsContainer.style.display = '';
  stepNav.style.display         = '';
  document.querySelector('.quiz-meta').style.display = '';
  loadingState.classList.remove('visible');

  // Reset step display
  document.querySelectorAll('.step').forEach(s => {
    s.classList.remove('active', 'exiting');
    s.style.transform = '';
    s.style.opacity   = '';
  });
  document.getElementById('step-1').classList.add('active');

  // Show quiz, hide result
  resultSection.classList.remove('visible');
  quizSection.classList.remove('hidden');

  updateProgress();
  updateNextButton();
  btnBack.style.visibility = 'hidden';
  progressFill.style.width = '0%';
  clearError();

  setTimeout(() => document.getElementById('input-name').focus(), 100);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Utility ───────────────────────────────────────────────
function extractPinyinPart(pinyin, index) {
  if (!pinyin) return '';
  const parts = pinyin.trim().split(/\s+/);
  return parts[index] || '';
}

function truncate(str, max) {
  if (!str || str.length <= max) return str;
  return str.slice(0, max) + '…';
}

// ── Init ──────────────────────────────────────────────────
setupOptionGroup('options-gender', 'gender');
setupOptionGroup('options-sound',  'sound');
setupOptionGroup('options-style',  'style');
updateProgress();
updateNextButton();

// Auto-focus name input on load
setTimeout(() => document.getElementById('input-name').focus(), 300);
