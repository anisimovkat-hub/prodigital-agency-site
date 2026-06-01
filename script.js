(function () {
  'use strict';

  const body = document.body;

  // ── Helpers ────────────────────────────────────────────────
  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[\s\/|–—.,:+()]+/g, '_')
      .replace(/[^a-zа-яё0-9_]/gi, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 64);
  }

  function reachGoal(goalName, params) {
    try {
      if (window.ym && goalName) window.ym(101833804, 'reachGoal', goalName, params || {});
    } catch (e) {}
  }

  // ── Brief Modal ────────────────────────────────────────────
  const briefModal = document.getElementById('briefModal');

  function openBriefModal(source) {
    if (!briefModal) return;
    briefModal.classList.add('open');
    briefModal.setAttribute('aria-hidden', 'false');
    body.style.overflow = 'hidden';
    briefModal.querySelectorAll('input[name="source"]').forEach(el => el.value = source || 'site');
    briefModal.querySelectorAll('input[name="page_url"]').forEach(el => el.value = window.location.href);
    const box = briefModal.querySelector('.modal-box');
    if (box) box.scrollTop = 0;
    const firstField = briefModal.querySelector('textarea[name="product"]');
    if (firstField) setTimeout(() => firstField.focus(), 100);
  }

  function closeBriefModal() {
    if (!briefModal) return;
    briefModal.classList.remove('open');
    briefModal.setAttribute('aria-hidden', 'true');
    body.style.overflow = '';
  }

  window.openBriefModal = openBriefModal;
  window.closeBriefModal = closeBriefModal;

  // Open triggers
  document.querySelectorAll('[data-open-brief]').forEach(btn => {
    btn.addEventListener('click', function () {
      openBriefModal(this.getAttribute('data-source') || 'site');
    });
  });

  // Close triggers
  document.querySelectorAll('[data-close-brief]').forEach(btn => {
    btn.addEventListener('click', closeBriefModal);
  });
  if (briefModal) {
    briefModal.addEventListener('click', e => { if (e.target === briefModal) closeBriefModal(); });
  }

  // ── Privacy Modal ──────────────────────────────────────────
  const privacyModal = document.getElementById('privacyModal');

  function openPrivacyModal() {
    if (!privacyModal) return;
    privacyModal.classList.add('open');
    privacyModal.setAttribute('aria-hidden', 'false');
    body.style.overflow = 'hidden';
    const box = privacyModal.querySelector('.modal-box');
    if (box) box.scrollTop = 0;
  }

  function closePrivacyModal() {
    if (!privacyModal) return;
    privacyModal.classList.remove('open');
    privacyModal.setAttribute('aria-hidden', 'true');
    // restore scroll only if brief is also closed
    if (!briefModal || !briefModal.classList.contains('open')) {
      body.style.overflow = '';
    }
  }

  window.openPrivacyModal = openPrivacyModal;

  document.querySelectorAll('[data-open-privacy]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); openPrivacyModal(); });
  });
  document.querySelectorAll('[data-close-privacy]').forEach(btn => {
    btn.addEventListener('click', closePrivacyModal);
  });
  if (privacyModal) {
    privacyModal.addEventListener('click', e => { if (e.target === privacyModal) closePrivacyModal(); });
  }

  // ── Case Detail Modal ──────────────────────────────────────
  const caseModal = document.getElementById('caseModal');

  function openCaseModal(caseId) {
    if (!caseModal) return;
    const data = window.CASES_DATA && window.CASES_DATA[caseId];
    if (!data) return;

    const title = caseModal.querySelector('.case-modal-title');
    const year  = caseModal.querySelector('.case-modal-year');
    const img   = caseModal.querySelector('.case-modal-img');
    const summary = caseModal.querySelector('.case-modal-summary-text');
    const stats = caseModal.querySelector('.case-stats-row');
    const task  = caseModal.querySelector('.case-task-text');
    const done  = caseModal.querySelector('.case-done-list');
    const result= caseModal.querySelector('.case-result-text');

    if (title)  title.textContent  = data.title  || '';
    if (year)   year.textContent   = data.year   || '';
    if (summary) summary.textContent = data.summary || data.task || '';

    if (img) {
      if (data.img) {
        img.innerHTML = `<img src="${data.img}" alt="${data.title || ''}">`;
      } else {
        img.innerHTML = `<div class="case-modal-placeholder">
          Скриншот из рекламного кабинета<br>
          <span style="font-size:12px;opacity:0.6;margin-top:6px;display:block">Будет добавлен позднее</span>
        </div>`;
      }
    }

    if (stats && data.stats) {
      stats.innerHTML = data.stats.map(s =>
        `<div class="case-stat-box"><span>${s.label}</span><strong>${s.value}</strong></div>`
      ).join('');
    }

    if (task)   task.innerHTML   = data.task   || '';
    if (done && data.done) {
      done.innerHTML = data.done.map(d => `<li>${d}</li>`).join('');
    }
    if (result) result.innerHTML = data.result || '';

    caseModal.classList.add('open');
    caseModal.setAttribute('aria-hidden', 'false');
    body.style.overflow = 'hidden';
    const box = caseModal.querySelector('.modal-box');
    if (box) box.scrollTop = 0;
  }

  function closeCaseModal() {
    if (!caseModal) return;
    caseModal.classList.remove('open');
    caseModal.setAttribute('aria-hidden', 'true');
    body.style.overflow = '';
  }

  window.openCaseModal = openCaseModal;

  if (caseModal) {
    caseModal.addEventListener('click', e => { if (e.target === caseModal) closeCaseModal(); });
    const closeBtn = caseModal.querySelector('[data-close-case]');
    if (closeBtn) closeBtn.addEventListener('click', closeCaseModal);
  }

  document.querySelectorAll('.case-cards-grid').forEach(grid => {
    const cards = Array.from(grid.querySelectorAll('.case-detail-card'));
    cards
      .map((card, index) => ({
        card,
        index,
        year: Math.max(...(((card.querySelector('.card-year') || {}).textContent || '').match(/\d{4}/g) || ['0']).map(Number)),
      }))
      .sort((a, b) => (b.year - a.year) || (a.index - b.index))
      .forEach(item => grid.appendChild(item.card));
  });

  document.querySelectorAll('[data-open-case]').forEach(btn => {
    btn.addEventListener('click', function () {
      openCaseModal(this.getAttribute('data-open-case'));
    });
  });

  // ── Success Toast ──────────────────────────────────────────
  function showSuccessToast() {
    let toast = document.getElementById('successToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'successToast';
      toast.className = 'toast-overlay';
      toast.innerHTML = `<div class="toast-box">
        <h3>Спасибо! Заявка отправлена.</h3>
        <p>Заявка сохранена. Свяжусь с вами в рабочее время для обсуждения проекта.</p>
        <div class="toast-btn">
          <button class="btn btn-primary" type="button" data-close-toast>Понятно</button>
        </div>
      </div>`;
      document.body.appendChild(toast);
    }
    toast.classList.add('open');
    toast.addEventListener('click', e => {
      if (e.target === toast || e.target.closest('[data-close-toast]')) {
        toast.classList.remove('open');
        body.style.overflow = '';
      }
    });
    body.style.overflow = 'hidden';
  }

  // data-close-toast on static toast (index.html)
  document.querySelectorAll('[data-close-toast]').forEach(btn => {
    btn.addEventListener('click', () => {
      const toast = document.getElementById('successToast');
      if (toast) toast.classList.remove('open');
      body.style.overflow = '';
    });
  });

  // ── Mobile Menu ────────────────────────────────────────────
  const mobileMenu = document.getElementById('mobileMenu');
  document.querySelectorAll('[data-mobile-toggle]').forEach(btn => {
    btn.addEventListener('click', () => mobileMenu && mobileMenu.classList.toggle('open'));
  });
  if (mobileMenu) {
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => mobileMenu.classList.remove('open'));
    });
  }

  // ── Keyboard: Escape closes everything ────────────────────
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeBriefModal();
    closePrivacyModal();
    closeCaseModal();
    const toast = document.getElementById('successToast');
    if (toast) { toast.classList.remove('open'); body.style.overflow = ''; }
    if (mobileMenu) mobileMenu.classList.remove('open');
  });

  // ── Contact input formatting ──────────────────────────────
  function normalizePhone(v) {
    v = String(v || '').replace(/[^\d+]/g, '');
    if (v.includes('+')) v = '+' + v.replace(/\+/g, '');
    else if (v) v = '+' + v;
    return v;
  }

  document.querySelectorAll('input[name="phone"], input[type="tel"]').forEach(input => {
    input.removeAttribute('maxlength');
    input.removeAttribute('pattern');
    input.addEventListener('focus', () => {
      if (!input.value.trim()) input.value = '+';
      setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0);
    });
    input.addEventListener('input', () => { input.value = normalizePhone(input.value); });
    input.addEventListener('keydown', e => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && (input.selectionStart || 0) <= 1 && input.value.startsWith('+')) {
        e.preventDefault();
      }
    });
    input.addEventListener('blur', () => {
      if (input.value.trim() === '+') input.value = '';
    });
  });

  document.querySelectorAll('input[name="telegram"]').forEach(input => {
    if (!input.value.trim()) input.value = '@';
    input.addEventListener('focus', () => {
      if (!input.value.trim()) input.value = '@';
      setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0);
    });
    input.addEventListener('input', () => {
      let v = input.value || '';
      if (!v.startsWith('@')) v = '@' + v.replace(/^@+/, '');
      input.value = v.replace(/\s+/g, '');
    });
    input.addEventListener('keydown', e => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && (input.selectionStart || 0) <= 1) {
        e.preventDefault();
      }
    });
    input.addEventListener('blur', () => {
      if (input.value.trim() === '') input.value = '@';
    });
  });

  // ── Form submission to Google Sheets ──────────────────────
  const GOOGLE_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzMABMOai2nDMXL4VlX455PxkjiFoVoB3Hmmajvv_TTEc8iNVGKg561-h5b2oGMs35KXg/exec';

  async function sendToServer(data) {
    if (!GOOGLE_SHEETS_WEB_APP_URL || !GOOGLE_SHEETS_WEB_APP_URL.startsWith('https://script.google.com/macros/s/')) {
      throw new Error('google_script_url_missing');
    }

    return new Promise((resolve, reject) => {
      const frameName = `google_sheets_submit_${Date.now()}`;
      const iframe = document.createElement('iframe');
      iframe.name = frameName;
      iframe.style.display = 'none';

      const submitForm = document.createElement('form');
      submitForm.method = 'POST';
      submitForm.action = GOOGLE_SHEETS_WEB_APP_URL;
      submitForm.target = frameName;
      submitForm.style.display = 'none';

      Object.entries(data).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value == null ? '' : String(value);
        submitForm.appendChild(input);
      });

      let settled = false;
      const cleanup = () => {
        window.setTimeout(() => {
          iframe.remove();
          submitForm.remove();
        }, 500);
      };
      const done = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ ok: true });
      };

      iframe.addEventListener('load', done);
      document.body.appendChild(iframe);
      document.body.appendChild(submitForm);
      submitForm.submit();

      window.setTimeout(done, 3500);
      window.setTimeout(() => {
        if (!settled) {
          cleanup();
          reject(new Error('google_script_timeout'));
        }
      }, 9000);
    });
  }

  function getSubmitErrorMessage(error) {
    const message = String(error && error.message ? error.message : error);
    if (message === 'google_script_url_missing') {
      return 'Форма пока не подключена к Google-таблице: нужно вставить URL веб-приложения Google Apps Script в script.js.';
    }
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
      return 'Не удалось отправить форму: браузер не смог подключиться к Google Apps Script. Проверьте URL веб-приложения и права доступа.';
    }
    return `Не удалось отправить форму. Причина: ${message}. Попробуйте ещё раз.`;
  }

  document.querySelectorAll('form[data-brief-form]').forEach(form => {
    const nameInput = form.querySelector('input[name="name"]');
    const telegramInput = form.querySelector('input[name="telegram"]');
    const phoneInput = form.querySelector('input[name="phone"]');
    const consentInput = form.querySelector('input[name="consent"]');
    const formError = form.querySelector('.form-error');
    const formSuccess = form.querySelector('.form-success');

    function clearErrors() {
      form.querySelectorAll('.field input, .field textarea').forEach(el => el.classList.remove('field-invalid'));
      form.querySelectorAll('.checkbox').forEach(el => el.classList.remove('field-invalid'));
      form.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; el.classList.remove('show'); });
      if (formError) { formError.textContent = ''; formError.classList.remove('show'); }
    }

    function setFieldErr(name, msg) {
      const el = form.querySelector(`[name="${name}"]`);
      const errEl = form.querySelector(`[data-error-for="${name}"]`);
      if (el) el.classList.add('field-invalid');
      if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
    }

    function showFormErrors(messages) {
      if (!formError || !messages.length) return;
      formError.innerHTML = `Заполните обязательные поля:<br>${messages.map(m => `• ${m}`).join('<br>')}`;
      formError.classList.add('show');
      formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors();

      const nameVal = (nameInput?.value || '').trim();
      const tgVal   = (telegramInput?.value || '').trim();
      const phoneVal = (phoneInput?.value || '').trim();
      const hasPhone = phoneVal && phoneVal !== '+';
      const hasTg    = tgVal && tgVal !== '@';

      let hasErrors = false;
      const errorMessages = [];

      if (!nameVal) {
        setFieldErr('name', 'Укажите ваше имя.');
        errorMessages.push('имя');
        hasErrors = true;
      }
      if (!hasPhone && !hasTg) {
        setFieldErr('telegram', 'Оставьте Telegram или телефон.');
        setFieldErr('phone', 'Оставьте телефон или Telegram.');
        errorMessages.push('Telegram или телефон');
        hasErrors = true;
      }
      if (consentInput && !consentInput.checked) {
        const checkbox = consentInput.closest('.checkbox');
        if (checkbox) checkbox.classList.add('field-invalid');
        errorMessages.push('согласие на обработку данных');
        hasErrors = true;
      }

      if (hasErrors) {
        showFormErrors(errorMessages);
        reachGoal('form_validation_error');
        return;
      }

      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Отправка…'; }

      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      payload.phone = hasPhone ? normalizePhone(phoneInput.value) : '';
      payload.telegram = hasTg ? tgVal : '';
      payload.form_name = form.getAttribute('name') || 'project-brief';
      payload.page_url = window.location.href;
      payload.submitted_at = new Date().toISOString();

      try {
        await sendToServer(payload);
        form.reset();
        if (phoneInput) phoneInput.value = '';
        if (telegramInput) telegramInput.value = '@';
        closeBriefModal();
        showSuccessToast();
        reachGoal('form_submit_success', { form: payload.form_name, source: payload.source });
      } catch (err) {
        if (formError) {
          formError.textContent = getSubmitErrorMessage(err);
          formError.classList.add('show');
          formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        reachGoal('form_submit_error', { error: String(err) });
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Отправить бриф'; }
      }
    });
  });

  // ── Analytics: click tracking ──────────────────────────────
  document.addEventListener('click', function (e) {
    const target = e.target.closest('a, button');
    if (!target) return;
    const explicit = target.getAttribute('data-goal');
    let goal = explicit;
    if (!goal) {
      const text = (target.textContent || '').trim();
      const href = target.getAttribute('href') || '';
      if (text) goal = 'click_' + slugify(text);
      else if (href) goal = 'click_' + slugify(href);
    }
    if (goal) reachGoal(goal, { text: (target.textContent || '').trim().slice(0, 80), href: target.getAttribute('href') || '', page: window.location.pathname });
  }, true);

})();
