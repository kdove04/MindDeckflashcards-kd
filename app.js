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
      el.innerHTML = `
        <h4>${escapeHtml(d.name)}</h4>
        <p>${escapeHtml(d.description || '')}</p>
        <p><small class="muted">${(d.cards||[]).length} cards</small></p>
      `;
      list.appendChild(el);
    });
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
    });
  }

  init();
})();
