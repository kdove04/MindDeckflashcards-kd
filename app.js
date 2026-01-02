// Simple client-side deck manager (localStorage)
(function(){
  const STORAGE_KEY = 'wwwf_decks_v1';

  function loadDecks(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
    catch(e){ console.error('loadDecks parse error', e); return [] }
  }

  function saveDecks(decks){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"
    }[c]));
  }

  /* --- UI helpers --- */
  function showSnackbar(message, actionText, actionFn, timeout=6000){
    // create a snackbar element and insert into DOM
    const existing = document.querySelector('.snackbar');
    if(existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'snackbar';
    el.textContent = message;
    if(actionText){
      const btn = document.createElement('button');
      btn.textContent = actionText;
      btn.addEventListener('click', ()=>{ actionFn && actionFn(); el.remove(); });
      el.appendChild(btn);
    }
    document.body.appendChild(el);
    const to = setTimeout(()=>{ el.remove(); }, timeout);
    return ()=>{ clearTimeout(to); el.remove(); };
  }

  function download(filename, text){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], {type:'application/json'}));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* Modal helper - returns a Promise that resolves to values or null on cancel */
  function openModal(options){
    // options: { title, fields: [{name,label,type,value}], submitText }
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const actions = document.getElementById('modal-actions');
    const closeBtn = document.getElementById('modal-close');
    if(!overlay || !body || !actions || !titleEl) return Promise.resolve(null);

    titleEl.textContent = options.title || 'Edit';
    body.innerHTML = '';
    actions.innerHTML = '';

    const inputs = {};
    (options.fields||[]).forEach(f=>{
      const label = document.createElement('label');
      label.textContent = f.label || f.name;
      const control = (f.type === 'textarea') ? document.createElement('textarea') : document.createElement('input');
      control.name = f.name; control.id = 'modal-'+f.name; control.value = f.value || '';
      if(f.type && f.type !== 'textarea') control.type = f.type;
      body.appendChild(label);
      body.appendChild(control);
      inputs[f.name] = control;
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn';
    submitBtn.textContent = options.submitText || 'Save';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn ghost';
    cancelBtn.textContent = 'Cancel';
    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);

    overlay.style.display = '';
    overlay.setAttribute('aria-hidden','false');

    // focus first input
    const first = Object.values(inputs)[0];
    if(first) first.focus();

    return new Promise(resolve=>{
      function cleanup(){
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden','true');
        submitBtn.removeEventListener('click', onSubmit);
        cancelBtn.removeEventListener('click', onCancel);
        closeBtn && closeBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlayClick);
        document.removeEventListener('keydown', onKey);
      }
      function onSubmit(e){
        e.preventDefault();
        const result = {};
        Object.keys(inputs).forEach(k=> result[k] = inputs[k].value);
        cleanup();
        resolve(result);
      }
      function onCancel(e){
        e && e.preventDefault();
        cleanup();
        resolve(null);
      }
      function onOverlayClick(e){ if(e.target === overlay) onCancel(); }
      function onKey(e){ if(e.key === 'Escape') onCancel(); }

      submitBtn.addEventListener('click', onSubmit);
      cancelBtn.addEventListener('click', onCancel);
      closeBtn && closeBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlayClick);
      document.addEventListener('keydown', onKey);
    });
  }


  function renderDecks(){
    const list = document.getElementById('decks-list');
    const decks = loadDecks();
    list.innerHTML = '';
    if(!decks.length){
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No decks yet — create one.';
      list.appendChild(p);
      return;
    }

    decks.forEach(d=>{
      const el = document.createElement('article');
      el.className = 'card';
      el.tabIndex = 0;
      el.dataset.id = d.id;
      el.innerHTML = `
        <h4>${escapeHtml(d.name)}</h4>
        <p>${escapeHtml(d.description || '')}</p>
        <p><small class="muted">${(d.cards||[]).length} cards</small></p>
        <div class="card-controls">
          <button type="button" class="btn small" data-action="add-card">Add card</button>
          <button type="button" class="btn small" data-action="edit-deck">Edit</button>
          <button type="button" class="btn ghost small" data-action="delete-deck">Delete deck</button>
        </div>
      `;
      // open deck detail when clicked or Enter pressed (but not when clicking controls)
      el.addEventListener('click', (ev)=>{
        const action = ev.target.closest('[data-action]');
        if(action) return; // controls will handle it
        showDeckDetail(true, d.id);
      });
      el.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') showDeckDetail(true, d.id); });

      // delegate control clicks
      el.querySelectorAll('[data-action]').forEach(btn=>{
        const action = btn.dataset.action;
        if(action === 'add-card'){
          btn.addEventListener('click', (ev)=>{
            ev.stopPropagation();
            showDeckDetail(true, d.id);
            // focus the front input after a short delay to ensure detail rendered
            setTimeout(()=>{
              const front = document.getElementById('card-front');
              if(front) front.focus();
            }, 150);
          });
        }
        if(action === 'edit-deck'){
          btn.addEventListener('click', async (ev)=>{
            ev.stopPropagation();
            const res = await openModal({
              title: 'Edit deck',
              fields: [
                { name: 'name', label: 'Deck name', type: 'text', value: d.name },
                { name: 'description', label: 'Description (optional)', type: 'textarea', value: d.description || '' }
              ],
              submitText: 'Save'
            });
            if(!res) return;
            const decksAll = loadDecks();
            const idx = decksAll.findIndex(dd=>dd.id === d.id);
            if(idx !== -1){ decksAll[idx].name = (res.name||'').trim() || decksAll[idx].name; decksAll[idx].description = (res.description||'').trim(); saveDecks(decksAll); renderDecks(); }
          });
        }
        if(action === 'delete-deck'){
          btn.addEventListener('click', (ev)=>{
            ev.stopPropagation();
            // remove and offer undo
            const decksAll = loadDecks();
            const remaining = decksAll.filter(dd=>dd.id !== d.id);
            saveDecks(remaining);
            renderDecks();
            // if we were viewing this deck, close detail
            const detailTitle = document.getElementById('deck-detail-title');
            if(detailTitle && detailTitle.textContent === d.name){ showDeckDetail(false); }
            // show undo snackbar
            showSnackbar(`Deleted "${d.name}"`, 'Undo', ()=>{
              const current = loadDecks();
              current.unshift(d);
              saveDecks(current);
              renderDecks();
            });
          });
        }
      });

      list.appendChild(el);
    });
  }

  /* --- Deck detail / card management --- */
  function getDeckById(id){
    const decks = loadDecks();
    return decks.find(d=>d.id === id);
  }

  function showDeckDetail(show, deckId){
    const aside = document.getElementById('deck-detail');
    if(!aside) return;
    aside.style.display = show ? 'block' : 'none';
    aside.setAttribute('aria-hidden', show ? 'false' : 'true');
    if(show){ renderDeckDetails(deckId); }
  }

  function renderDeckDetails(deckId){
    const deck = getDeckById(deckId);
    const title = document.getElementById('deck-detail-title');
    const list = document.getElementById('deck-cards-list');
    const addForm = document.getElementById('add-card-form');
    if(!deck || !title || !list) return;
    title.textContent = deck.name;
    list.innerHTML = '';

    if(!deck.cards || !deck.cards.length){
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No cards in this deck yet.';
      list.appendChild(p);
    } else {
      deck.cards.forEach(c=>{
        const el = document.createElement('article');
        el.className = 'deck-card';
        el.innerHTML = `
          <p><strong>${escapeHtml(c.front)}</strong></p>
          <p>${escapeHtml(c.back)}</p>
          <div class="card-controls">
            <button class="btn small" data-action="edit-card" data-card-id="${c.id}">Edit</button>
            <button class="delete" data-card-id="${c.id}">Delete</button>
          </div>
        `;
        // delete handler
        el.querySelector('.delete').addEventListener('click', (ev)=>{
          ev.stopPropagation();
          const decks = loadDecks();
          const idx = decks.findIndex(dd=>dd.id === deck.id);
          if(idx === -1) return;
          const removed = decks[idx].cards.find(x=>x.id === c.id);
          decks[idx].cards = decks[idx].cards.filter(x=>x.id !== c.id);
          saveDecks(decks);
          renderDeckDetails(deck.id);
          renderDecks();
          showSnackbar('Card deleted', 'Undo', ()=>{
            const cur = loadDecks();
            const findIdx = cur.findIndex(dd=>dd.id === deck.id);
            if(findIdx !== -1){ cur[findIdx].cards.push(removed); saveDecks(cur); renderDeckDetails(deck.id); renderDecks(); }
          });
        });
        // edit handler
        const editBtn = el.querySelector('[data-action="edit-card"]');
        if(editBtn){
          editBtn.addEventListener('click', async (ev)=>{
            ev.stopPropagation();
            const res = await openModal({
              title: 'Edit card',
              fields: [
                { name: 'front', label: 'Front', type: 'text', value: c.front },
                { name: 'back', label: 'Back', type: 'text', value: c.back }
              ],
              submitText: 'Save'
            });
            if(!res) return;
            const decks = loadDecks();
            const di = decks.findIndex(dd=>dd.id === deck.id);
            if(di === -1) return;
            const ci = decks[di].cards.findIndex(x=>x.id === c.id);
            if(ci === -1) return;
            decks[di].cards[ci].front = (res.front||'').trim();
            decks[di].cards[ci].back = (res.back||'').trim();
            saveDecks(decks);
            renderDeckDetails(deck.id);
            renderDecks();
          });
        }
        list.appendChild(el);
      });
    }

    // attach deck id to add form for reference
    if(addForm){ addForm.dataset.deckId = deck.id; }
  }

  function showForm(show){
    const form = document.getElementById('create-deck-form');
    if(!form) return;
    form.style.display = show ? 'flex' : 'none';
    form.setAttribute('aria-hidden', show ? 'false' : 'true');
    if(show){ document.getElementById('deck-name').focus(); }
  }

  /* Export / Import */
  function exportDecks(){
    const decks = loadDecks();
    download('minddeck-decks.json', JSON.stringify(decks, null, 2));
  }

  function importDeckFile(file){
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const parsed = JSON.parse(reader.result);
        if(!Array.isArray(parsed)) throw new Error('Invalid format');
        // assign new ids if missing and merge
        const existing = loadDecks();
        const merged = existing.concat(parsed.map(d=>({ id: d.id || Date.now()+Math.random(), name: d.name||'Imported', description: d.description||'', cards: Array.isArray(d.cards)?d.cards.map(c=>({ id: c.id||Date.now()+Math.random(), front:c.front||'', back:c.back||'' })) : [] })));
        saveDecks(merged);
        renderDecks();
        showSnackbar('Imported decks', null, null, 3000);
      }catch(err){
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function init(){
    document.addEventListener('DOMContentLoaded', ()=>{
      renderDecks();

      // Navigation behavior for the 'Decks' nav link:
      // - If this page contains a `#decks` section, a normal left-click will
      //   smoothly scroll to it (in-page experience).
      // - If the user uses a modifier key (Shift/Ctrl/Meta/Alt) or middle-click,
      //   the browser's default navigation will be allowed (open decks.html/new tab).
      const navDecks = document.getElementById('nav-decks');
      if(navDecks){
        navDecks.addEventListener('click', (e)=>{
          const decksSection = document.getElementById('decks');
          // If no in-page decks section, let the link navigate normally.
          if(!decksSection) return;
          // Allow navigation if user used any modifier key (common pattern to open in new tab/window)
          if(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
          // Only handle left button clicks; allow middle-clicks and others
          if('button' in e && e.button !== 0) return;
          // Intercept and perform smooth in-page scroll
          e.preventDefault();
          showDeckDetail(false);
          renderDecks();
          decksSection.scrollIntoView({behavior:'smooth', block:'start'});
        });
      }

      const btn = document.getElementById('create-deck-btn');
      const form = document.getElementById('create-deck-form');
      const cancel = document.getElementById('create-deck-cancel');

      if(btn){ btn.addEventListener('click', ()=> showForm(true)); }
      if(cancel){ cancel.addEventListener('click', ()=> { form.reset(); showForm(false); }); }

      if(form){
        form.addEventListener('submit', (ev)=>{
          ev.preventDefault();
          const name = form.elements['name'].value.trim();
          const description = form.elements['description'].value.trim();
          if(!name){ alert('Please provide a deck name'); return; }

          const decks = loadDecks();
          const deck = { id: Date.now(), name, description, cards: [] };
          decks.unshift(deck);
          saveDecks(decks);
          form.reset();
          showForm(false);
          renderDecks();
        });
      }

      // Deck detail interactions
      const deckClose = document.getElementById('deck-detail-close');
      const addCardForm = document.getElementById('add-card-form');
      const addCardCancel = document.getElementById('add-card-cancel');

      if(deckClose){ deckClose.addEventListener('click', ()=> showDeckDetail(false)); }
      if(addCardCancel){ addCardCancel.addEventListener('click', ()=> { addCardForm.reset(); }); }

      if(addCardForm){
        addCardForm.addEventListener('submit', (ev)=>{
          ev.preventDefault();
          const deckId = Number(addCardForm.dataset.deckId);
          const front = addCardForm.elements['front'].value.trim();
          const back = addCardForm.elements['back'].value.trim();
          if(!front || !back){ alert('Please provide both front and back'); return; }

          const decks = loadDecks();
          const idx = decks.findIndex(d=>d.id === deckId);
          if(idx === -1){ alert('Deck not found'); return; }
          const card = { id: Date.now(), front, back };
          decks[idx].cards = decks[idx].cards || [];
          decks[idx].cards.push(card);
          saveDecks(decks);
          addCardForm.reset();
          renderDeckDetails(deckId);
          renderDecks();
        });
      }

      // export / import handlers (if present on page)
      const exportBtn = document.getElementById('export-decks');
      const importInput = document.getElementById('import-file');
      if(exportBtn){ exportBtn.addEventListener('click', ()=> exportDecks()); }
      if(importInput){ importInput.addEventListener('change', (e)=>{ const f = e.target.files && e.target.files[0]; if(f) importDeckFile(f); importInput.value = ''; }); }

      // study controls
      const startStudyBtn = document.getElementById('start-study');
      const studyView = document.getElementById('study-view');
      const studyFront = document.getElementById('study-front');
      const studyBack = document.getElementById('study-back');
      const studyFlip = document.getElementById('study-flip');
      const studyNext = document.getElementById('study-next');
      const studyPrev = document.getElementById('study-prev');
      const studyExit = document.getElementById('study-exit');

      let _study = { deckId: null, idx:0, showingBack:false };

      function renderStudy(){
        const deck = getDeckById(_study.deckId);
        if(!deck || !deck.cards || !deck.cards.length){ alert('No cards to study'); return; }
        const card = deck.cards[_study.idx];
        studyFront.textContent = card.front;
        studyBack.textContent = card.back;
        studyFront.style.display = _study.showingBack ? 'none' : '';
        studyBack.style.display = _study.showingBack ? '' : 'none';
      }

      function showStudy(show, deckId){
        if(!studyView) return;
        studyView.style.display = show ? 'flex' : 'none';
        studyView.setAttribute('aria-hidden', show ? 'false' : 'true');
        const cardsList = document.getElementById('deck-cards');
        const addFormEl = document.getElementById('add-card-form');
        if(cardsList) cardsList.style.display = show ? 'none' : '';
        if(addFormEl) addFormEl.style.display = show ? 'none' : '';
        if(show){ _study = { deckId: deckId, idx:0, showingBack:false }; renderStudy(); }
      }

      if(startStudyBtn){ startStudyBtn.addEventListener('click', ()=>{
        // if deck open, start study on that deck; else no-op
        const detailTitle = document.getElementById('deck-detail-title');
        const deckName = detailTitle ? detailTitle.textContent : null;
        const decks = loadDecks();
        const deck = decks.find(d=>d.name === deckName);
        if(!deck) { alert('Open a deck to study'); return; }
        showStudy(true, deck.id);
      }); }

      if(studyFlip){ studyFlip.addEventListener('click', ()=>{ _study.showingBack = !_study.showingBack; renderStudy(); }); }
      if(studyNext){ studyNext.addEventListener('click', ()=>{ const deck = getDeckById(_study.deckId); if(!deck) return; _study.idx = (_study.idx+1) % deck.cards.length; _study.showingBack = false; renderStudy(); }); }
      if(studyPrev){ studyPrev.addEventListener('click', ()=>{ const deck = getDeckById(_study.deckId); if(!deck) return; _study.idx = (_study.idx-1+deck.cards.length) % deck.cards.length; _study.showingBack = false; renderStudy(); }); }
      if(studyExit){ studyExit.addEventListener('click', ()=> showStudy(false)); }
    });
  }

  init();
})();
