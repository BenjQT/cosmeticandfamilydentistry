(() => {
  const PHONE = '(407) 270-1429';

  /* ── Appointment form ─────────────────────────────────────────── */
  const form = document.getElementById('book');
  const interestInput = form.querySelector('input[name="interest"]');
  const chips = form.querySelectorAll('[data-interests] .btn');

  chips.forEach(chip => chip.addEventListener('click', () => {
    chips.forEach(c => {
      const on = c === chip;
      c.classList.toggle('btn-primary', on);
      c.classList.toggle('btn-secondary', !on);
      c.setAttribute('aria-pressed', String(on));
    });
    interestInput.value = chip.textContent.trim();
  }));

  form.addEventListener('submit', e => {
    e.preventDefault();
    // TODO: send Object.fromEntries(new FormData(form)) to the practice's booking backend.
    form.querySelector('.book-fields').hidden = true;
    form.querySelector('.book-sent').hidden = false;
  });

  /* ── Chat widget ──────────────────────────────────────────────── */
  const chat = document.getElementById('chat');
  const launcher = document.querySelector('.chat-launcher');
  const log = chat.querySelector('.chat-log');
  const chatForm = chat.querySelector('.chat-form');
  const chatInput = chatForm.elements.q;

  const SYSTEM_PROMPT = `You are the friendly front desk assistant for Dr. Ravi Oberoi's Cosmetic & Family Dentistry in Orlando, FL.
Facts: Address 6900 Turkey Lake Rd Ste 1-9, Orlando, FL 32819 (near Sand Lake / Dr. Phillips). Phone ${PHONE}. Accepting new patients of all ages.
Five Star Dentist and Preferred Invisalign Provider; currently running an Invisalign discount (details by phone).
Services: Invisalign, veneers, dental implants, crowns & bridges, cosmetic dentistry (whitening, bonding, smile makeovers), restorations, family & general dentistry, emergency dentistry.
Insurance: Delta Dental, Cigna, Anthem Blue Cross, Humana, Aflac, Assurant; also cash and credit cards. ADA member, BBB A+.
Rules: Keep answers short (2-4 sentences), warm, plain text, no markdown. Never diagnose or quote exact prices; say the dentist will assess at a visit. You don't know office hours; suggest calling. For severe pain, swelling, bleeding or trauma, tell them to call ${PHONE} now, or 911 if life-threatening. Encourage booking via the "Request an appointment" form or by phone. Politely decline unrelated topics.`;

  const SUGGESTIONS = ['Do you take my insurance?', 'Tell me about Invisalign', 'I have a toothache', 'How do I book?'];

  const state = {
    open: false,
    loading: false,
    messages: [{ role: 'assistant', text: 'Hi! I’m the front desk assistant for Cosmetic & Family Dentistry. Ask me about services, insurance, or booking a visit.' }]
  };

  // Offline answers used when no model endpoint is available (e.g. the static site).
  const CANNED = [
    [/pain|ache|swell|bleed|broke|broken|chipped|emergenc|knocked|trauma/i,
      `I’m sorry you’re hurting. For severe pain, swelling, bleeding or a broken tooth, please call us now at ${PHONE} so we can see you quickly. If it’s life-threatening, call 911.`],
    [/insur|delta|cigna|anthem|blue cross|humana|aflac|assurant|pay|credit|cash/i,
      `We accept Delta Dental, Cigna, Anthem Blue Cross, Humana, Aflac and Assurant, plus cash and credit cards. For questions about your specific plan, give us a call at ${PHONE}.`],
    [/invisalign|aligner|straight|brace/i,
      `We’re a Preferred Invisalign Provider, and we’re currently running an Invisalign discount. Clear aligners straighten teeth without metal braces. Call ${PHONE} for offer details or request a visit using the form.`],
    [/veneer/i,
      'Veneers are thin porcelain shells that reshape chipped, stained or uneven teeth. Dr. Oberoi will assess whether they’re right for you at a consultation.'],
    [/implant|missing/i,
      'Dental implants are permanent replacements for missing teeth that look and function like your own. The dentist will evaluate your options at a visit.'],
    [/whiten|bond|makeover|cosmetic/i,
      'We offer whitening, bonding and full smile makeovers planned around your goals. Book a consultation and we’ll talk through options.'],
    [/crown|bridge|filling|restor/i,
      'We restore damaged teeth with crowns, bridges and tooth-colored fillings that blend with your natural smile. The dentist will recommend the best option at your visit.'],
    [/price|cost|how much|\$/i,
      `Costs depend on your needs and coverage, so the dentist will assess and give you a clear plan at your visit. Call ${PHONE} with any billing questions.`],
    [/hour|open|close|time|saturday|sunday|weekend/i,
      `I don’t have our current office hours handy. Please call ${PHONE} and the front desk will help.`],
    [/where|address|location|direction|park/i,
      'We’re at 6900 Turkey Lake Rd Ste 1-9, Orlando, FL 32819, near Sand Lake and Dr. Phillips.'],
    [/book|appoint|schedul|visit|new patient/i,
      `We’re accepting new patients of all ages. Use the “Request an appointment” form on this page, or call ${PHONE}, and we’ll confirm a time within one business day.`],
    [/kid|child|family|clean|checkup|exam/i,
      'We provide cleanings, exams and preventive care for patients of all ages, so the whole family can be seen here.']
  ];

  function cannedReply(q) {
    const hit = CANNED.find(([re]) => re.test(q));
    return hit ? hit[1]
      : `I can help with questions about our services, insurance and booking. For anything else, please call the office at ${PHONE}.`;
  }

  async function getReply(messages) {
    if (window.claude && typeof window.claude.complete === 'function') {
      const reply = await window.claude.complete({
        system: SYSTEM_PROMPT,
        messages: messages.slice(1).map(m => ({ role: m.role, content: m.text }))
      });
      return String(reply).trim();
    }
    await new Promise(r => setTimeout(r, 450));
    return cannedReply(messages[messages.length - 1].text);
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function render() {
    log.replaceChildren(...state.messages.map(m =>
      el('div', `msg ${m.role === 'user' ? 'msg-user' : 'msg-bot'}`, m.text)));
    if (state.loading) log.append(el('div', 'chat-typing', 'Typing…'));
    if (state.messages.length === 1 && !state.loading) {
      const row = el('div', 'chat-suggestions');
      SUGGESTIONS.forEach(label => {
        const b = el('button', 'btn btn-secondary', label);
        b.type = 'button';
        b.addEventListener('click', () => ask(label));
        row.append(b);
      });
      log.append(row);
    }
    log.scrollTop = log.scrollHeight;
  }

  async function ask(text) {
    const q = (text || '').trim();
    if (!q || state.loading) return;
    state.messages.push({ role: 'user', text: q });
    state.loading = true;
    chatInput.value = '';
    render();
    let reply;
    try {
      reply = await getReply(state.messages);
    } catch (err) {
      reply = `Sorry, I’m having trouble right now. Please call us at ${PHONE}.`;
    }
    state.messages.push({ role: 'assistant', text: reply });
    state.loading = false;
    render();
  }

  function setOpen(open) {
    state.open = open;
    chat.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    launcher.querySelector('span').textContent = open ? 'Close chat' : 'Ask us anything';
    if (open) { render(); chatInput.focus(); } else { launcher.focus(); }
  }

  document.querySelectorAll('[data-chat-toggle]').forEach(b =>
    b.addEventListener('click', () => setOpen(!state.open)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.open) setOpen(false); });
  chatForm.addEventListener('submit', e => { e.preventDefault(); ask(chatInput.value); });
})();
