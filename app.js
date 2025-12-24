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
        if(action === 'delete-deck'){
          btn.addEventListener('click', (ev)=>{
            ev.stopPropagation();
            if(!confirm(`Delete deck "${d.name}"? This will remove all its cards.`)) return;
            const decksAll = loadDecks();
            const remaining = decksAll.filter(dd=>dd.id !== d.id);
            saveDecks(remaining);
            // if we were viewing this deck, close detail
            const detailTitle = document.getElementById('deck-detail-title');
            if(detailTitle && detailTitle.textContent === d.name){ showDeckDetail(false); }
            renderDecks();
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
          <div class="card-controls"><button class="delete" data-card-id="${c.id}">Delete</button></div>
        `;
        // delete handler
        el.querySelector('.delete').addEventListener('click', (ev)=>{
          ev.stopPropagation();
          const decks = loadDecks();
          const idx = decks.findIndex(dd=>dd.id === deck.id);
          if(idx === -1) return;
          decks[idx].cards = decks[idx].cards.filter(x=>x.id !== c.id);
          saveDecks(decks);
          renderDeckDetails(deck.id);
          renderDecks();
        });
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

  function init(){
    document.addEventListener('DOMContentLoaded', ()=>{
      renderDecks();

      // Navigation behavior: don't intercept clicks on the nav 'Decks' link
      // so that clicking from the index page always follows the link to decks.html.

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
    });
  }

  init();
})();
