document.addEventListener('DOMContentLoaded', () => {
  
  /* ==========================================================================
     DOM ELEMENTS
     ========================================================================== */
  const heroCta = document.getElementById('hero-cta-btn');
  const bottomCtaBtn = document.getElementById('bottom-cta-btn');
  const stickyCtaBar = document.getElementById('sticky-cta-bar');
  const stickyRegisterBtn = document.getElementById('sticky-register-btn');
  
  // Track Page View
  if (typeof mixpanel !== 'undefined') {
    mixpanel.track('Page Viewed');
  }
  
  const regModal = document.getElementById('reg-modal');
  const successModal = document.getElementById('success-modal');
  const modalBackdrop = document.getElementById('modal-backdrop');
  
  const regClose = document.getElementById('reg-modal-close');
  
  const regForm = document.getElementById('reg-form');
  const regTypeSelect = document.getElementById('reg-type');
  const teammatesContainer = document.getElementById('teammates-container');
  
  const regSubmitBtn = document.getElementById('reg-submit-btn');
  const successDoneBtn = document.getElementById('success-done-btn');
  
  // Registration data cached during steps
  let registrationData = {};
  
  /* ==========================================================================
     GSAP INTERACTIVE ANIMATIONS
     ========================================================================== */
  
  // Safety wrapper in case GSAP/ScrollTrigger fails to load (offline or CDN blocked)
  const isGsapLoaded = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

  if (isGsapLoaded) {
    // Hide elements synchronously on DOM load to prevent Flash of Unstyled Content (FOUC)
    gsap.set('.animate-scroll', { opacity: 0, y: 30 });
    gsap.set('.animate-bento', { opacity: 0, y: 40, scale: 0.95 });

    // Register ScrollTrigger Plugin
    gsap.registerPlugin(ScrollTrigger);

    // 1. Hero Load Animations using GSAP
    gsap.from('.animate-hero', {
      y: 35,
      opacity: 0,
      duration: 0.85,
      stagger: 0.12,
      ease: 'power4.out',
      delay: 0.1
    });

    // 2. Bento Grid staggered reveal ScrollTrigger
    gsap.to('.animate-bento', {
      scrollTrigger: {
        trigger: '.bento-grid',
        start: 'top 82%',
        toggleActions: 'play none none none'
      },
      y: 0,
      scale: 1,
      opacity: 1,
      duration: 0.8,
      stagger: 0.15,
      ease: 'power3.out'
    });

    // 3. ScrollTrigger for individual scroll elements
    document.querySelectorAll('.animate-scroll').forEach(element => {
      gsap.to(element, {
        scrollTrigger: {
          trigger: element,
          start: 'top 85%',
          toggleActions: 'play none none none'
        },
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power2.out'
      });
    });
  }

  // 3. Modal Opening Animation (with GSAP & vanilla JS fallback)
  function openModal(modal) {
    modalBackdrop.style.display = 'flex';
    modal.style.display = 'block';

    if (isGsapLoaded) {
      gsap.fromTo(modalBackdrop,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: 'power2.out' }
      );
      gsap.fromTo(modal,
        { scale: 0.92, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.5)' }
      );
    } else {
      modalBackdrop.style.opacity = '1';
      modal.style.opacity = '1';
    }
  }

  // 4. Modal Closing Animation (with GSAP & vanilla JS fallback)
  function closeModal(modal) {
    if (isGsapLoaded) {
      gsap.to(modal, {
        scale: 0.94,
        opacity: 0,
        duration: 0.25,
        ease: 'power2.in',
        onComplete: () => {
          modal.style.display = 'none';
        }
      });

      gsap.to(modalBackdrop, {
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          modalBackdrop.style.display = 'none';
        }
      });
    } else {
      modal.style.display = 'none';
      modalBackdrop.style.display = 'none';
      modalBackdrop.style.opacity = '0';
    }
  }

  // 5. Shake animation for invalid inputs using GSAP (or skip if GSAP is unavailable)
  function shakeElement(el) {
    if (isGsapLoaded) {
      gsap.fromTo(el, 
        { x: -8 },
        { x: 8, clearProps: 'x', repeat: 5, duration: 0.05, yoyo: true, ease: 'sine.inOut' }
      );
    }
  }

  /* ==========================================================================
     STICKY NAVIGATION BAR
     ========================================================================== */
  
  const navbar = document.getElementById('navbar');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 480) {
      stickyCtaBar.classList.add('visible');
    } else {
      stickyCtaBar.classList.remove('visible');
    }
    // Frosted glass navbar effect on scroll
    if (navbar) {
      if (window.scrollY > 60) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }
  });

  const trackRegStart = (source) => {
    if (typeof mixpanel !== 'undefined') { mixpanel.track('Registration Started', { source: source }); }
    openModal(regModal);
  };

  stickyRegisterBtn.addEventListener('click', () => trackRegStart('sticky_nav'));
  bottomCtaBtn.addEventListener('click', () => trackRegStart('bottom_cta'));
  if (heroCta) {
    heroCta.addEventListener('click', () => trackRegStart('hero_cta'));
  }
  // Nav CTA button (new in redesign)
  const navCtaBtn = document.getElementById('nav-cta-btn');
  if (navCtaBtn) {
    navCtaBtn.addEventListener('click', () => trackRegStart('main_nav'));
  }

  /* ==========================================================================
     LIVE EVENT COUNTDOWN TIMER
     ========================================================================== */
  
  function updateCountdown() {
    const targetDate = new Date('2026-07-22T09:00:00+05:30').getTime(); // Space Pune time zone
    const now = new Date().getTime();
    const difference = targetDate - now;

    if (difference <= 0) {
      document.getElementById('countdown').innerHTML = `<div class="badge" style="font-size: 1rem;">SPARK DAY IS LIVE</div>`;
      return;
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    document.getElementById('days').textContent = days.toString().padStart(2, '0');
    document.getElementById('hours').textContent = hours.toString().padStart(2, '0');
    document.getElementById('minutes').textContent = minutes.toString().padStart(2, '0');
    document.getElementById('seconds').textContent = seconds.toString().padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  /* ==========================================================================
     FAQ INTERACTIVE ACCORDION
     ========================================================================== */
  
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all other active items
      faqItems.forEach(otherItem => {
        if (otherItem !== item && otherItem.classList.contains('active')) {
          otherItem.classList.remove('active');
          const otherAnswer = otherItem.querySelector('.faq-answer');
          if (isGsapLoaded) {
            gsap.to(otherAnswer, { height: 0, duration: 0.3, ease: 'power2.out' });
          } else {
            otherAnswer.style.height = '0';
          }
        }
      });

      // Toggle this item
      if (isActive) {
        item.classList.remove('active');
        if (isGsapLoaded) {
          gsap.to(answer, { height: 0, duration: 0.3, ease: 'power2.out' });
        } else {
          answer.style.height = '0';
        }
      } else {
        item.classList.add('active');
        if (isGsapLoaded) {
          gsap.fromTo(answer, 
            { height: 0 },
            { height: 'auto', duration: 0.35, ease: 'power2.out' }
          );
        } else {
          answer.style.height = 'auto';
        }
      }
    });
  });

  /* ==========================================================================
     DYNAMIC REGISTRATION FORM
     ========================================================================== */
  
  // Toggle teammate fields based on registration type (with new pricing ₹1,000 for team of 3)
  regTypeSelect.addEventListener('change', (e) => {
    const isTeam = e.target.value === 'team';
    if (typeof mixpanel !== 'undefined') { mixpanel.track('Entry Type Selected', { type: e.target.value }); }
    
    if (isTeam) {
      teammatesContainer.style.display = 'block';
      
      if (isGsapLoaded) {
        // GSAP animate open
        gsap.fromTo(teammatesContainer, 
          { opacity: 0, y: -15 },
          { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
        );
      } else {
        teammatesContainer.style.opacity = '1';
      }
      
      // Set teammate fields as required
      document.querySelectorAll('.teammate-field').forEach(field => {
        field.setAttribute('required', 'true');
      });
    } else {
      
      if (isGsapLoaded) {
        // GSAP animate close
        gsap.to(teammatesContainer, {
          opacity: 0,
          y: -15,
          duration: 0.25,
          ease: 'power2.in',
          onComplete: () => {
            teammatesContainer.style.display = 'none';
          }
        });
      } else {
        teammatesContainer.style.display = 'none';
      }
      
      // Remove required attribute from teammate fields
      document.querySelectorAll('.teammate-field').forEach(field => {
        field.removeAttribute('required');
        field.classList.remove('invalid');
      });
    }
  });

  // Helper to parse date strings across multiple local/browser formats
  function parseDateString(str) {
    if (!str) return null;
    str = str.trim();
    
    // Check if it matches YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const parts = str.split('-');
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    
    // Check if it matches DD/MM/YYYY or DD-MM-YYYY
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      const p2 = parseInt(parts[2], 10);
      
      if (p2 >= 1000) {
        return new Date(p2, p1 - 1, p0);
      }
      if (p0 >= 1000) {
        return new Date(p0, p1 - 1, p2);
      }
    }
    
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Age Gate helper function: strictly 17-19 on July 22, 2026
  function checkAgeGate(dobString) {
    if (!dobString) return false;
    const dob = parseDateString(dobString);
    if (!dob) return false;
    
    // July 22, 2026 event day DOB bounds (month index 6 = July):
    const minDob = new Date(2006, 6, 23); // 19 years old (turns 20 on July 22)
    const maxDob = new Date(2009, 6, 22); // 17 years old (turns 17 on July 22)
    
    return dob >= minDob && dob <= maxDob;
  }

  // Handle Form Submission with validations
  regForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    let isValid = true;
    const formData = new FormData(regForm);
    const type = formData.get('reg_type');
    
    // Clear previous invalid states
    regForm.querySelectorAll('.form-input').forEach(input => {
      input.classList.remove('invalid');
    });

    // 1. Validate Lead Details
    const leadName = document.getElementById('lead-name');
    if (!leadName.value.trim()) {
      leadName.classList.add('invalid');
      shakeElement(leadName);
      isValid = false;
    }

    const leadEmail = document.getElementById('lead-email');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(leadEmail.value)) {
      leadEmail.classList.add('invalid');
      shakeElement(leadEmail);
      isValid = false;
    }

    const leadPhone = document.getElementById('lead-phone');
    const phoneRegex = /^\+?[0-9]{10,14}$/;
    if (!phoneRegex.test(leadPhone.value.replace(/[\s-]/g, ''))) {
      leadPhone.classList.add('invalid');
      shakeElement(leadPhone);
      isValid = false;
    }

    const leadDob = document.getElementById('lead-dob');
    if (!checkAgeGate(leadDob.value)) {
      leadDob.classList.add('invalid');
      shakeElement(leadDob);
      isValid = false;
    }

    const leadStream = document.getElementById('lead-stream');
    if (!leadStream.value.trim()) {
      leadStream.classList.add('invalid');
      shakeElement(leadStream);
      isValid = false;
    }

    // 2. Validate Teammates if Type is Team
    if (type === 'team') {
      const t2Name = document.getElementById('t2-name');
      const t2Email = document.getElementById('t2-email');
      const t2Phone = document.getElementById('t2-phone');
      const t2Dob = document.getElementById('t2-dob');

      const t3Name = document.getElementById('t3-name');
      const t3Email = document.getElementById('t3-email');
      const t3Phone = document.getElementById('t3-phone');
      const t3Dob = document.getElementById('t3-dob');

      // Teammate 2 checks
      if (!t2Name.value.trim()) { t2Name.classList.add('invalid'); shakeElement(t2Name); isValid = false; }
      if (!emailRegex.test(t2Email.value)) { t2Email.classList.add('invalid'); shakeElement(t2Email); isValid = false; }
      if (!phoneRegex.test(t2Phone.value.replace(/[\s-]/g, ''))) { t2Phone.classList.add('invalid'); shakeElement(t2Phone); isValid = false; }
      if (!checkAgeGate(t2Dob.value)) { t2Dob.classList.add('invalid'); shakeElement(t2Dob); isValid = false; }

      // Teammate 3 checks
      if (!t3Name.value.trim()) { t3Name.classList.add('invalid'); shakeElement(t3Name); isValid = false; }
      if (!emailRegex.test(t3Email.value)) { t3Email.classList.add('invalid'); shakeElement(t3Email); isValid = false; }
      if (!phoneRegex.test(t3Phone.value.replace(/[\s-]/g, ''))) { t3Phone.classList.add('invalid'); shakeElement(t3Phone); isValid = false; }
      if (!checkAgeGate(t3Dob.value)) { t3Dob.classList.add('invalid'); shakeElement(t3Dob); isValid = false; }
    }

    if (!isValid) return;

    // Cache the validated data
    registrationData = {
      type: type,
      lead: {
        name: leadName.value,
        email: leadEmail.value,
        phone: leadPhone.value,
        dob: leadDob.value,
        stream: leadStream.value
      }
    };

    if (type === 'team') {
      registrationData.teammates = [
        {
          name: document.getElementById('t2-name').value,
          email: document.getElementById('t2-email').value,
          phone: document.getElementById('t2-phone').value,
          dob: document.getElementById('t2-dob').value
        },
        {
          name: document.getElementById('t3-name').value,
          email: document.getElementById('t3-email').value,
          phone: document.getElementById('t3-phone').value,
          dob: document.getElementById('t3-dob').value
        }
      ];
    }

    // Update Submit Button State
    regSubmitBtn.disabled = true;
    regSubmitBtn.textContent = 'Registering...';

    // Submit Registration Data to Backend
    fetch('/api/register-free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Tracking: Registration Successful
        if (typeof mixpanel !== 'undefined') { mixpanel.track('Registration Successful', { orderId: data.order_id }); }
        if (typeof fbq !== 'undefined') { fbq('track', 'CompleteRegistration', { currency: 'INR', value: 0 }); }
        if (typeof gtag !== 'undefined') { gtag('event', 'purchase', { transaction_id: data.order_id, currency: 'INR', value: 0 }); }
        
        document.getElementById('success-id').textContent = data.order_id;
        
        closeModal(regModal);
        setTimeout(() => {
          openModal(successModal);
          if (isGsapLoaded) {
            gsap.fromTo('.success-checkmark__circle',
              { strokeDashoffset: 166 },
              { strokeDashoffset: 0, duration: 0.8, ease: 'power2.out' }
            );
            gsap.fromTo('.success-checkmark__check',
              { strokeDashoffset: 48 },
              { strokeDashoffset: 0, duration: 0.5, delay: 0.4, ease: 'power2.out' }
            );
          }
        }, 300);
      } else {
        alert('Registration failed. Please try again or contact support.');
        regSubmitBtn.disabled = false;
        regSubmitBtn.textContent = 'Complete Registration &rarr;';
      }
    })
    .catch(() => {
      alert('Could not connect to the server. Please try again later.');
      regSubmitBtn.disabled = false;
      regSubmitBtn.textContent = 'Complete Registration &rarr;';
    });
  });

  // Success Done Click
  successDoneBtn.addEventListener('click', () => {
    closeModal(successModal);
    regForm.reset();
    teammatesContainer.style.display = 'none';
    regSubmitBtn.disabled = false;
    regSubmitBtn.textContent = 'Complete Registration &rarr;';
  });


});
