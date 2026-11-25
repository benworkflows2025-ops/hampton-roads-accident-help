(() => {
  'use strict';

  const init = () => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const scrollBehavior = () => motionPreference.matches ? 'auto' : 'smooth';
    const form = document.querySelector('form[data-review-form]');
    const menuToggle = document.querySelector('[data-menu-toggle]');
    const mobileMenu = document.getElementById('mobile-menu');

    const closeMenu = (restoreFocus = false) => {
      if (!menuToggle || !mobileMenu) return;
      menuToggle.setAttribute('aria-expanded', 'false');
      mobileMenu.hidden = true;
      if (restoreFocus) menuToggle.focus();
    };

    if (menuToggle && mobileMenu) {
      menuToggle.addEventListener('click', () => {
        const open = menuToggle.getAttribute('aria-expanded') !== 'true';
        menuToggle.setAttribute('aria-expanded', String(open));
        mobileMenu.hidden = !open;
      });
      mobileMenu.addEventListener('click', event => {
        if (event.target.closest('a')) closeMenu();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
          closeMenu(true);
        }
      });
      document.addEventListener('click', event => {
        if (!mobileMenu.contains(event.target) && !menuToggle.contains(event.target)) closeMenu();
      });
    }

    document.addEventListener('click', event => {
      const link = event.target.closest('a[data-review-link]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = document.getElementById('review');
      if (!target) return;
      event.preventDefault();
      closeMenu();
      target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      const currentStage = form && form.querySelector('[data-form-step]:not([hidden])');
      const focusTarget = (currentStage && currentStage.querySelector('input:not([disabled])')) || document.getElementById('review-title');
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    });

    if (!form) return;

    const stages = [form.querySelector('[data-form-step="1"]'), form.querySelector('[data-form-step="2"]')];
    const nextButton = form.querySelector('[data-next]');
    const backButton = form.querySelector('[data-back]');
    const submitButton = form.querySelector('button[type="submit"]');
    const nameInput = form.querySelector('input[name="name"]');
    const phoneInput = form.querySelector('input[name="phone"]');
    const emailInput = form.querySelector('input[name="email"]');
    const consentInput = form.querySelector('input[name="consent"]');
    const consentText = form.querySelector('[data-consent-text]');
    const errorBox = document.querySelector('[data-form-error]');
    const statusBox = document.querySelector('[data-form-status]');
    const stepNumber = document.querySelector('[data-step-number]');
    const progress = document.querySelector('[data-progress]');
    const previewNotice = document.querySelector('[data-preview-notice]');
    const config = window.HRAH_FORM_CONFIG || { endpoint: '', consentVersion: 'original' };
    const endpointSetting = typeof config.endpoint === 'string' ? config.endpoint.trim() : '';
    const radioNames = ['when', 'hurt', 'fault', 'lawyer'];
    const invalidFields = new Map();
    let currentStep = 1;
    let pending = false;
    let submitted = false;
    let pendingSubmissionId = null;

    // Keep the HTML's safe, non-submitting fallback if required markup is missing.
    if (!stages.every(Boolean) || !nameInput || !phoneInput || !consentInput || !nextButton || !backButton || !submitButton || !errorBox || !statusBox) return;

    form.noValidate = true;
    if (!errorBox.id) errorBox.id = 'review-form-error';
    errorBox.setAttribute('role', 'alert');
    statusBox.setAttribute('role', 'status');
    statusBox.setAttribute('aria-live', 'polite');
    statusBox.setAttribute('tabindex', '-1');
    if (previewNotice) previewNotice.hidden = Boolean(endpointSetting);

    const clearErrors = () => {
      invalidFields.forEach((previousDescription, field) => {
        field.removeAttribute('aria-invalid');
        if (previousDescription) field.setAttribute('aria-describedby', previousDescription);
        else field.removeAttribute('aria-describedby');
      });
      invalidFields.clear();
      errorBox.hidden = true;
      errorBox.textContent = '';
    };

    const showError = (message, field) => {
      errorBox.textContent = message;
      errorBox.hidden = false;
      if (field) {
        if (!invalidFields.has(field)) invalidFields.set(field, field.getAttribute('aria-describedby') || '');
        field.setAttribute('aria-invalid', 'true');
        const describedBy = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
        describedBy.add(errorBox.id);
        field.setAttribute('aria-describedby', [...describedBy].join(' '));
        field.focus();
      } else {
        errorBox.setAttribute('tabindex', '-1');
        errorBox.focus();
      }
    };

    const showStatus = message => {
      statusBox.textContent = message;
      statusBox.hidden = false;
    };

    const showStep = (step, moveFocus = true) => {
      currentStep = step;
      stages.forEach((stage, index) => { stage.hidden = index !== step - 1; });
      if (stepNumber) stepNumber.textContent = `Step ${step} of 2`;
      if (progress) {
        progress.style.width = `${step * 50}%`;
        const progressBar = progress.matches('[role="progressbar"]') ? progress : progress.closest('[role="progressbar"]');
        if (progressBar) progressBar.setAttribute('aria-valuenow', String(step * 50));
      }
      clearErrors();
      statusBox.hidden = true;
      if (moveFocus) {
        const target = step === 1 ? nameInput : stages[1].querySelector('legend, input');
        if (target) {
          if (target.tagName === 'LEGEND') target.setAttribute('tabindex', '-1');
          target.focus();
        }
      }
    };

    const validateContact = () => {
      if (!nameInput.value.trim()) {
        if (currentStep !== 1) showStep(1, false);
        showError('Please enter your name.', nameInput);
        return false;
      }
      const digitCount = phoneInput.value.replace(/\D/g, '').length;
      if (digitCount < 7 || digitCount > 15) {
        if (currentStep !== 1) showStep(1, false);
        showError('Please enter a phone number with 7 to 15 digits.', phoneInput);
        return false;
      }
      // Email is optional; only check it when they typed one.
      if (emailInput && emailInput.value.trim() && !emailInput.checkValidity()) {
        if (currentStep !== 1) showStep(1, false);
        showError('Please check your email address, or leave it blank.', emailInput);
        return false;
      }
      return true;
    };

    const validateQuestions = () => {
      for (const fieldName of radioNames) {
        const checked = form.querySelector(`input[name="${fieldName}"]:checked`);
        if (!checked) {
          const firstRadio = form.querySelector(`input[name="${fieldName}"]`);
          const question = firstRadio && firstRadio.closest('fieldset');
          const legend = question && question.querySelector('legend');
          showError(legend ? `Please choose an answer for “${legend.textContent.trim()}”` : 'Please answer each question.', firstRadio);
          return false;
        }
      }
      if (!consentInput.checked) {
        showError('Please read and select the consent checkbox to continue.', consentInput);
        return false;
      }
      return true;
    };

    const nextStep = () => {
      if (pending || submitted) return;
      clearErrors();
      if (validateContact()) showStep(2);
    };

    const submissionId = () => {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const bytes = window.crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
        const random = Math.floor(Math.random() * 16);
        return (character === 'x' ? random : (random & 3) | 8).toString(16);
      });
    };

    const getEndpoint = () => {
      const url = new URL(endpointSetting, window.location.href);
      const sameOriginHttp = url.origin === window.location.origin && ['http:', 'https:'].includes(url.protocol);
      if ((!sameOriginHttp && url.protocol !== 'https:') || url.username || url.password) throw new Error('Invalid endpoint');
      return url.href;
    };

    nextButton.addEventListener('click', nextStep);
    backButton.addEventListener('click', () => {
      if (!pending && !submitted) showStep(1);
    });
    form.addEventListener('input', () => {
      if (pending || submitted) return;
      pendingSubmissionId = null;
      clearErrors();
      statusBox.hidden = true;
    });
    form.addEventListener('change', () => {
      if (pending || submitted) return;
      pendingSubmissionId = null;
      clearErrors();
      statusBox.hidden = true;
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (pending || submitted) return;
      if (currentStep === 1) {
        nextStep();
        return;
      }
      clearErrors();
      statusBox.hidden = true;
      if (!validateContact() || !validateQuestions()) return;

      // Preview mode never sends, stores, logs, or claims receipt of contact data.
      if (!endpointSetting) {
        showStatus('This is a preview. Your information has not been sent.');
        statusBox.focus();
        return;
      }

      let endpoint;
      try {
        endpoint = getEndpoint();
      } catch {
        showError('The review form is temporarily unavailable. Please try again later.');
        return;
      }

      const payload = {
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput ? emailInput.value.trim() : '',
        when: form.querySelector('input[name="when"]:checked').value,
        hurt: form.querySelector('input[name="hurt"]:checked').value,
        fault: form.querySelector('input[name="fault"]:checked').value,
        lawyer: form.querySelector('input[name="lawyer"]:checked').value,
        consent: true,
        consent_text: consentText ? consentText.textContent.trim() : '',
        consent_version: config.consentVersion || 'original',
        source_page: window.location.pathname,
        submitted_at: new Date().toISOString(),
        submission_id: pendingSubmissionId || (pendingSubmissionId = submissionId())
      };

      // Never send a consent record without the actual displayed consent copy.
      if (!payload.consent_text) {
        showError('The review form is temporarily unavailable. Please try again later.');
        return;
      }

      pending = true;
      form.setAttribute('aria-busy', 'true');
      const controls = Array.from(form.querySelectorAll('input, button, select, textarea'));
      const disabledStates = controls.map(control => control.disabled);
      controls.forEach(control => { control.disabled = true; });
      const submitMarkup = submitButton.innerHTML;
      submitButton.textContent = 'Sending…';
      showStatus('Sending your request…');
      const abort = new AbortController();
      const timeout = window.setTimeout(() => abort.abort(), 20000);

      try {
        const response = await window.fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'omit',
          body: JSON.stringify(payload),
          signal: abort.signal
        });
        // GHL inbound webhooks answer 200 with their own JSON, not {success:true}; a 2xx means accepted.
        if (!response.ok) throw new Error('Request not accepted');

        submitted = true;
        form.dataset.submissionState = 'success';
        form.reset();
        stages.forEach(stage => { stage.hidden = true; });
        if (stepNumber) stepNumber.textContent = 'Review sent';
        showStatus('Thanks, we got it!\nA local injury attorney will look it over and call you soon.');
        statusBox.classList.add('is-success');
        statusBox.focus();
      } catch {
        statusBox.hidden = true;
        showError('We couldn’t confirm your request. Your details are still here. Please try again.');
      } finally {
        window.clearTimeout(timeout);
        pending = false;
        form.removeAttribute('aria-busy');
        controls.forEach((control, index) => { control.disabled = disabledStates[index]; });
        submitButton.innerHTML = submitMarkup;
      }
    });

    // Only enable interception after the complete safe handler is installed.
    form.removeAttribute('onsubmit');
    showStep(1, false);

    const mobileCta = document.querySelector('.mobile-cta');
    if (mobileCta) {
      let formInView = false;
      const updateCta = () => {
        const shouldHide = formInView || form.contains(document.activeElement);
        mobileCta.hidden = shouldHide;
        mobileCta.style.display = shouldHide ? 'none' : '';
      };
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
          formInView = entries[0].isIntersecting;
          updateCta();
        }, { rootMargin: '-80px 0px -80px 0px', threshold: 0 });
        observer.observe(form);
      } else {
        let scheduled = false;
        const checkVisibility = () => {
          const bounds = form.getBoundingClientRect();
          formInView = bounds.bottom > 80 && bounds.top < window.innerHeight - 80;
          scheduled = false;
          updateCta();
        };
        window.addEventListener('scroll', () => {
          if (!scheduled) {
            scheduled = true;
            window.requestAnimationFrame(checkVisibility);
          }
        }, { passive: true });
        window.addEventListener('resize', checkVisibility);
        checkVisibility();
      }
      form.addEventListener('focusin', updateCta);
      form.addEventListener('focusout', () => window.requestAnimationFrame(updateCta));
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

/* Hide the header while scrolling down, show it again when scrolling up */
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;
  var last = window.scrollY;
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    var menuOpen = document.getElementById('mobile-menu') && !document.getElementById('mobile-menu').hidden;
    if (y > last && y > 120 && !menuOpen) header.classList.add('is-hidden');
    else if (y < last - 4 || y < 120) header.classList.remove('is-hidden');
    last = y;
  }, { passive: true });
})();
