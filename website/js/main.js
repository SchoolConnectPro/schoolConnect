/* ============================================================
   SCHOOLCONNECT — MAIN JAVASCRIPT
   ============================================================ */

// ---- AOS INIT ----
AOS.init({
  duration: 700,
  easing: 'ease-out-cubic',
  once: true,
  offset: 60
});

// ---- NAVBAR SCROLL ----
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// ---- HAMBURGER MENU ----
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  navLinks.classList.toggle('mobile-open');
});

// Close mobile menu on link click
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navLinks.classList.remove('mobile-open');
  });
});

// ---- SMOOTH SCROLL ----
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ---- HERO CHAT ANIMATION ----
function runChatAnimation() {
  const msg2 = document.getElementById('msg2');
  const msg3 = document.getElementById('msg3');
  const msg4 = document.getElementById('msg4');
  const typingText = document.getElementById('typingText');

  const messages = [
    { el: msg2, delay: 1500 },
    { el: msg3, delay: 3500 },
    { el: msg4, delay: 5000 }
  ];

  // Typewriter in input bar
  const phrases = [
    'Sports Day on 30 April all classes',
    'Diksha absent class 8B',
    'Science homework ch 3-4 due thursday 8B',
    'Math test on 12 April chapters 4-5 grade 8B'
  ];
  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let typingTimeout;

  function typeWriter() {
    const current = phrases[phraseIndex];
    if (!isDeleting) {
      typingText.textContent = current.substring(0, charIndex + 1);
      charIndex++;
      if (charIndex === current.length) {
        isDeleting = true;
        typingTimeout = setTimeout(typeWriter, 2000);
        return;
      }
    } else {
      typingText.textContent = current.substring(0, charIndex - 1);
      charIndex--;
      if (charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
      }
    }
    typingTimeout = setTimeout(typeWriter, isDeleting ? 40 : 70);
  }
  typeWriter();

  // Show messages sequentially
  function showMessage(index) {
    if (index >= messages.length) {
      // Reset after full cycle
      setTimeout(() => {
        messages.forEach(m => m.el.classList.add('hidden'));
        setTimeout(() => showMessage(0), 500);
      }, 4000);
      return;
    }
    setTimeout(() => {
      messages[index].el.classList.remove('hidden');
      messages[index].el.style.animation = 'msgSlideIn 0.4s ease';
      showMessage(index + 1);
    }, messages[index].delay);
  }

  setTimeout(() => showMessage(0), 1000);
}

// Add CSS for message animation
const style = document.createElement('style');
style.textContent = `
  @keyframes msgSlideIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);

runChatAnimation();

// ---- FEATURE TABS ----
const featureTabs = document.querySelectorAll('.feature-tab');
featureTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabId = tab.dataset.tab;

    // Update active tab
    featureTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Show correct grid
    document.querySelectorAll('.features-grid').forEach(grid => {
      grid.classList.remove('active');
    });
    const target = document.getElementById('tab-' + tabId);
    if (target) {
      target.classList.add('active');
      // Re-trigger AOS for newly visible cards
      target.querySelectorAll('[data-aos]').forEach(el => {
        el.classList.remove('aos-animate');
        setTimeout(() => el.classList.add('aos-animate'), 50);
      });
    }
  });
});

// ---- ANIMATED COUNTERS ----
function animateCounter(el, target, duration = 1500) {
  const start = 0;
  const startTime = performance.now();
  const isLarge = target >= 1000;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);

    if (isLarge) {
      // Format large numbers
      if (current >= 1000000) {
        el.textContent = (current / 100000).toFixed(0);
      } else if (current >= 100000) {
        el.textContent = (current / 100000).toFixed(1);
      } else {
        el.textContent = current.toLocaleString('en-IN');
      }
    } else {
      el.textContent = current;
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      if (isLarge) {
        el.textContent = '15';
      } else {
        el.textContent = target;
      }
    }
  }
  requestAnimationFrame(update);
}

// Trigger counters when stats section is visible
const statsSection = document.getElementById('stats');
let countersTriggered = false;

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !countersTriggered) {
      countersTriggered = true;
      document.querySelectorAll('.stat-number').forEach(el => {
        const target = parseInt(el.dataset.target);
        if (!isNaN(target)) animateCounter(el, target);
      });
    }
  });
}, { threshold: 0.3 });

if (statsSection) statsObserver.observe(statsSection);

// ---- PRICING TOGGLE ----
const billingToggle = document.getElementById('billingToggle');
const monthlyLabel = document.getElementById('monthlyLabel');
const annualLabel = document.getElementById('annualLabel');

if (billingToggle) {
  billingToggle.addEventListener('change', () => {
    const isAnnual = billingToggle.checked;

    monthlyLabel.classList.toggle('active', !isAnnual);
    annualLabel.classList.toggle('active', isAnnual);

    document.querySelectorAll('.monthly-price').forEach(el => {
      el.closest('.plan-price').style.display = isAnnual ? 'none' : 'flex';
    });
    document.querySelectorAll('.annual-price-wrap').forEach(el => {
      el.style.display = isAnnual ? 'flex' : 'none';
    });
  });
}

// ---- FAQ ACCORDION ----
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const answer = item.querySelector('.faq-answer');
    const isOpen = item.classList.contains('open');

    // Close all
    document.querySelectorAll('.faq-item').forEach(i => {
      i.classList.remove('open');
      i.querySelector('.faq-answer').classList.remove('open');
    });

    // Open clicked if it was closed
    if (!isOpen) {
      item.classList.add('open');
      answer.classList.add('open');
    }
  });
});

// ---- DEMO FORM ----
const demoForm = document.getElementById('demoForm');
if (demoForm) {
  demoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formCard = demoForm.closest('.cta-form-card') || demoForm.closest('.demo-form-card');
    formCard.innerHTML = `
      <div class="form-success">
        <div class="form-success-icon"><i class="fas fa-check"></i></div>
        <h3>Demo Request Received!</h3>
        <p>We'll WhatsApp you within 24 hours to schedule your live demo.</p>
        <p style="margin-top:8px; color: var(--green); font-weight: 600;">
          <i class="fab fa-whatsapp"></i> Check your WhatsApp soon.
        </p>
      </div>
    `;
  });
}

// ---- ACTIVE NAV LINK ON SCROLL ----
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop - 120;
    if (window.scrollY >= sectionTop) {
      current = section.getAttribute('id');
    }
  });
  navAnchors.forEach(a => {
    a.classList.remove('active-nav');
    if (a.getAttribute('href') === '#' + current) {
      a.classList.add('active-nav');
    }
  });
}, { passive: true });

// Add active nav style
const navStyle = document.createElement('style');
navStyle.textContent = `.nav-links a.active-nav { color: var(--green) !important; }`;
document.head.appendChild(navStyle);

// ---- SCROLL REVEAL FOR TRUST STRIP ----
const trustItems = document.querySelectorAll('.trust-item');
trustItems.forEach((item, i) => {
  item.style.animationDelay = `${i * 0.1}s`;
});

// ---- PARALLAX HERO ORBS ----
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  const orb1 = document.querySelector('.hero-orb-1');
  const orb2 = document.querySelector('.hero-orb-2');
  if (orb1) orb1.style.transform = `translateY(${scrollY * 0.15}px)`;
  if (orb2) orb2.style.transform = `translateY(${-scrollY * 0.1}px)`;
}, { passive: true });

// ---- CARD TILT EFFECT ----
document.querySelectorAll('.feature-card, .pricing-card, .testimonial-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / centerY * -4;
    const rotateY = (x - centerX) / centerX * 4;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
});

// ---- INTERSECTION OBSERVER FOR SECTION TAGS ----
const sectionTags = document.querySelectorAll('.section-tag');
const tagObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animation = 'tagPop 0.5s ease forwards';
    }
  });
}, { threshold: 0.5 });

const tagStyle = document.createElement('style');
tagStyle.textContent = `
  @keyframes tagPop {
    0% { transform: scale(0.8); opacity: 0; }
    60% { transform: scale(1.05); }
    100% { transform: scale(1); opacity: 1; }
  }
`;
document.head.appendChild(tagStyle);
sectionTags.forEach(tag => tagObserver.observe(tag));

// ---- CONSOLE EASTER EGG ----
console.log('%c SchoolConnect ', 'background: #25D366; color: white; font-size: 16px; font-weight: bold; padding: 8px 16px; border-radius: 8px;');
console.log('%c AI-Powered School Communication on WhatsApp', 'color: #25D366; font-size: 12px;');
console.log('%c Built by Arshdeep Singh, Gurgaon 🇮🇳', 'color: #94A3B8; font-size: 11px;');