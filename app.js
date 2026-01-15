// Simple client-side deck manager (localStorage)
(function(){
  const STORAGE_KEY = 'wwwf_decks_v1';

  async function loadDecks(){
    try {
      const response = await fetch('/api/decks');
      if (response.ok) {
        const serverDecks = await response.json();
        // Save to localStorage as cache
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverDecks));
        return serverDecks;
      }
    } catch (e) {
      console.error('Failed to load from server, using localStorage:', e);
    }
    // Fallback to localStorage
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
    catch(e){ console.error('loadDecks parse error', e); return [] }
  }

  async function saveDecks(decks){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
    try {
      await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decks)
      });
    } catch (e) {
      console.error('Failed to save to server:', e);
    }
  }

  async function updateDeckOnServer(deck) {
    try {
      const response = await fetch(`/api/decks/${deck.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deck)
      });
      if (!response.ok) throw new Error('Failed to update deck');
      return true;
    } catch (e) {
      console.error('Error updating deck on server:', e);
      return false;
    }
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
      control.name = f.name; control.id = 'modal-'+f.name + (f.type === 'radio' ? '-' + f.value : ''); control.value = f.value || '';
      if(f.type && f.type !== 'textarea') control.type = f.type;
      if(f.type === 'radio' && f.checked) control.checked = true;
      body.appendChild(label);
      body.appendChild(control);
      if(!inputs[f.name]) inputs[f.name] = [];
      inputs[f.name].push(control);
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
    const firstKey = Object.keys(inputs)[0];
    const first = Array.isArray(inputs[firstKey]) ? inputs[firstKey][0] : inputs[firstKey];
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
        Object.keys(inputs).forEach(k=>{
          if(Array.isArray(inputs[k])){
            // radio group
            const checked = inputs[k].find(r => r.checked);
            result[k] = checked ? checked.value : null;
          } else {
            result[k] = inputs[k].value;
          }
        });
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


  async function renderDecks(){
    const list = document.getElementById('decks-list');
    const decks = await loadDecks();
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
      el.addEventListener('click', async (ev)=>{
        const action = ev.target.closest('[data-action]');
        if(action) return; // controls will handle it
        await showDeckDetail(true, d.id);
      });
      el.addEventListener('keydown', async (e)=>{ if(e.key === 'Enter') await showDeckDetail(true, d.id); });

      // delegate control clicks
      el.querySelectorAll('[data-action]').forEach(btn=>{
        const action = btn.dataset.action;
        if(action === 'add-card'){
          btn.addEventListener('click', async (ev)=>{
            ev.stopPropagation();
            await showDeckDetail(true, d.id);
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
            const decksAll = await loadDecks();
            const idx = decksAll.findIndex(dd=>dd.id === d.id);
            if(idx !== -1){ 
              decksAll[idx].name = (res.name||'').trim() || decksAll[idx].name; 
              decksAll[idx].description = (res.description||'').trim(); 
              await saveDecks(decksAll); 
              updateDeckOnServer(decksAll[idx]); // save to server
              await renderDecks(); 
            }
          });
        }
        if(action === 'delete-deck'){
          btn.addEventListener('click', async (ev)=>{
            ev.stopPropagation();
            // remove and offer undo
            const decksAll = await loadDecks();
            const remaining = decksAll.filter(dd=>dd.id !== d.id);
            await saveDecks(remaining);
            await renderDecks();
            // if we were viewing this deck, close detail
            const detailTitle = document.getElementById('deck-detail-title');
            if(detailTitle && detailTitle.textContent === d.name){ showDeckDetail(false); }
            // show undo snackbar
            showSnackbar(`Deleted "${d.name}"`, 'Undo', async ()=>{
              const current = await loadDecks();
              current.unshift(d);
              await saveDecks(current);
              await renderDecks();
            });
          });
        }
      });

      list.appendChild(el);
    });
  }

  /* --- Deck detail / card management --- */
  async function getDeckById(id){
    const decks = await loadDecks();
    return decks.find(d=>d.id === id);
  }

  async function showDeckDetail(show, deckId){
    const aside = document.getElementById('deck-detail');
    if(!aside) return;
    aside.style.display = show ? 'block' : 'none';
    aside.setAttribute('aria-hidden', show ? 'false' : 'true');
    if(show){ await renderDeckDetails(deckId); }
  }

  async function renderDeckDetails(deckId){
    const deck = await getDeckById(deckId);
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
        el.querySelector('.delete').addEventListener('click', async (ev)=>{
          ev.stopPropagation();
          const decks = await loadDecks();
          const idx = decks.findIndex(dd=>dd.id === deck.id);
          if(idx === -1) return;
          const removed = decks[idx].cards.find(x=>x.id === c.id);
          decks[idx].cards = decks[idx].cards.filter(x=>x.id !== c.id);
          saveDecks(decks);
          await renderDeckDetails(deck.id);
          renderDecks();
          showSnackbar('Card deleted', 'Undo', async ()=>{
            const cur = await loadDecks();
            const findIdx = cur.findIndex(dd=>dd.id === deck.id);
            if(findIdx !== -1){ cur[findIdx].cards.push(removed); saveDecks(cur); await renderDeckDetails(deck.id); renderDecks(); }
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
            const decks = await loadDecks();
            const di = decks.findIndex(dd=>dd.id === deck.id);
            if(di === -1) return;
            const ci = decks[di].cards.findIndex(x=>x.id === c.id);
            if(ci === -1) return;
            decks[di].cards[ci].front = (res.front||'').trim();
            decks[di].cards[ci].back = (res.back||'').trim();
            saveDecks(decks);
            await renderDeckDetails(deck.id);
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
    form.style.display = show ? 'block' : 'none';
    form.setAttribute('aria-hidden', show ? 'false' : 'true');
    if(show){ 
      // Small delay to ensure form is visible before focusing
      setTimeout(() => {
        const nameInput = document.getElementById('deck-name');
        if(nameInput) nameInput.focus();
      }, 100);
    }
  }

  /* Export / Import */
  async function exportDecks(){
    const decks = await loadDecks();
    download('minddeck-decks.json', JSON.stringify(decks, null, 2));
  }

  async function exportDecksCSV(){
    const decks = await loadDecks();
    if(!decks || decks.length === 0){
      showSnackbar('No decks to export', null, null, 3000);
      return;
    }
    
    // CSV format: deck_name,deck_description,front,back
    let csv = 'deck_name,deck_description,front,back\n';
    
    decks.forEach(deck => {
      const deckName = (deck.name || 'Untitled Deck').replace(/"/g, '""');
      const deckDesc = (deck.description || '').replace(/"/g, '""');
      
      if(deck.cards && deck.cards.length > 0){
        deck.cards.forEach(card => {
          const front = (card.front || '').replace(/"/g, '""');
          const back = (card.back || '').replace(/"/g, '""');
          csv += `"${deckName}","${deckDesc}","${front}","${back}"\n`;
        });
      } else {
        // Empty deck - still export it
        csv += `"${deckName}","${deckDesc}","",""\n`;
      }
    });
    
    download('minddeck-decks.csv', csv);
  }

  function parseCSV(csvText){
    if(!csvText || !csvText.trim()){
      throw new Error('CSV file is empty');
    }

    // Parse CSV (handling quoted fields with newlines)
    function parseCSVContent(text){
      const rows = [];
      let currentRow = [];
      let current = '';
      let inQuotes = false;
      
      for(let i = 0; i < text.length; i++){
        const char = text[i];
        const nextChar = text[i + 1];
        
        if(char === '"'){
          if(inQuotes && nextChar === '"'){
            // Escaped quote
            current += '"';
            i++; // skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if(char === ',' && !inQuotes){
          // Field separator
          currentRow.push(current.trim());
          current = '';
        } else if((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes){
          // Row separator (only if not in quotes)
          if(char === '\r') i++; // skip \n after \r
          currentRow.push(current.trim());
          if(currentRow.some(f => f)){ // Only add non-empty rows
            rows.push(currentRow);
          }
          currentRow = [];
          current = '';
        } else {
          current += char;
        }
      }
      
      // Add last field and row
      if(current || currentRow.length > 0){
        currentRow.push(current.trim());
        if(currentRow.some(f => f)){
          rows.push(currentRow);
        }
      }
      
      return rows;
    }

    const parsedLines = parseCSVContent(csvText);
    
    // Detect format by checking first line
    const firstLine = parsedLines[0];
    const hasHeader = firstLine[0].toLowerCase() === 'deck_name' || 
                     firstLine[0].toLowerCase() === 'front' ||
                     firstLine[0].toLowerCase() === 'question';
    
    const startIdx = hasHeader ? 1 : 0;
    const cards = [];
    
    for(let i = startIdx; i < parsedLines.length; i++){
      const line = parsedLines[i];
      if(line.length < 2) continue; // Skip incomplete lines
      
      let front, back;
      
      if(line.length >= 4){
        // Format: deck_name,deck_description,front,back - ignore deck_name and desc
        [, , front, back] = line;
      } else if(line.length === 2){
        // Format: front,back
        [front, back] = line;
      } else {
        continue; // Skip invalid lines
      }
      
      front = (front || '').trim();
      back = (back || '').trim();
      
      if(!front && !back) continue; // Skip empty cards
      
      cards.push({
        front: front || 'Untitled',
        back: back || 'Untitled'
      });
    }
    
    // Return one deck with all cards
    return [{
      name: 'Imported Deck',
      description: '',
      cards: cards
    }];
  }

  function importDeckFile(file){
    if(!file) return;
    
    // Validate file type
    const fileName = file.name.toLowerCase();
    const isJSON = fileName.endsWith('.json');
    const isCSV = fileName.endsWith('.csv');
    
    if(!isJSON && !isCSV){
      showSnackbar('Please select a JSON or CSV file', null, null, 4000);
      return;
    }

    const reader = new FileReader();
    
    reader.onerror = ()=>{
      showSnackbar('Error reading file. Please try again.', null, null, 4000);
    };

    reader.onload = async ()=>{
      try{
        if(!reader.result){
          throw new Error('File appears to be empty');
        }

        let decksToImport = [];
        
        if(isJSON){
          // Parse JSON
          const parsed = JSON.parse(reader.result);
          
          // Validate structure
          if(!parsed){
            throw new Error('File contains invalid data');
          }

          let cards = [];
          
          if(Array.isArray(parsed)){
            if(parsed.length > 0){
              if(parsed[0].cards && Array.isArray(parsed[0].cards)){
                // Array of decks - merge all cards
                cards = parsed.flatMap(d => d.cards || []);
              } else if(parsed[0].front !== undefined || parsed[0].back !== undefined){
                // Array of cards
                cards = parsed.map(c => ({
                  front: c.front || '',
                  back: c.back || ''
                }));
              } else {
                throw new Error('Invalid JSON format: expected array of decks or cards');
              }
            }
          } else if(typeof parsed === 'object'){
            if(parsed.cards && Array.isArray(parsed.cards)){
              // Single deck
              cards = parsed.cards;
            } else if(parsed.front !== undefined || parsed.back !== undefined){
              // Single card
              cards = [parsed];
            } else {
              throw new Error('Invalid JSON format: expected deck or card object');
            }
          } else {
            throw new Error('Invalid format: expected an array or object');
          }
          
          decksToImport = [{
            name: 'Imported Deck',
            description: '',
            cards: cards
          }];
        } else if(isCSV){
          // Parse CSV
          decksToImport = parseCSV(reader.result);
          
          if(decksToImport.length === 0){
            throw new Error('No valid data found in CSV file');
          }
        }

        // Validate and normalize each deck
        const normalizedDecks = decksToImport.map((d, idx)=>{
          if(!d || typeof d !== 'object'){
            throw new Error(`Invalid deck at position ${idx + 1}`);
          }
          
          return {
            id: d.id || Date.now() + Math.random() + idx,
            name: (d.name || 'Imported Deck').trim() || `Imported Deck ${idx + 1}`,
            description: (d.description || '').trim(),
            cards: Array.isArray(d.cards) 
              ? d.cards.map((c, cIdx)=>({
                  id: c.id || Date.now() + Math.random() + cIdx,
                  front: (c.front || '').trim() || 'Untitled',
                  back: (c.back || '').trim() || 'Untitled'
                }))
              : []
          };
        });

        // Merge with existing decks
        const existing = await loadDecks();
        const merged = existing.concat(normalizedDecks);
        
        // Check localStorage quota
        try{
          saveDecks(merged);
        } catch(e){
          if(e.name === 'QuotaExceededError'){
            throw new Error('Not enough storage space. Please free up some space and try again.');
          }
          throw e;
        }

        renderDecks();
        const count = normalizedDecks.length;
        showSnackbar(`Successfully imported ${count} deck${count !== 1 ? 's' : ''}`, 'Undo', ()=>{
          saveDecks(existing);
          renderDecks();
          showSnackbar('Import undone', null, null, 3000);
        }, 6000);
      }catch(err){
        console.error('Import error:', err);
        const errorMsg = err.message || 'Unknown error occurred';
        showSnackbar(`Import failed: ${errorMsg}`, null, null, 5000);
      }
    };
    
    reader.readAsText(file);
  }

  function init(){
    document.addEventListener('DOMContentLoaded', ()=>{
      // Hero flashcard flip interaction (only on index.html)
      const heroFlashcard = document.getElementById('hero-flashcard');
      if(heroFlashcard){
        heroFlashcard.addEventListener('click', ()=>{
          heroFlashcard.classList.toggle('flipped');
        });
        // Also allow keyboard interaction
        heroFlashcard.addEventListener('keydown', (e)=>{
          if(e.key === 'Enter' || e.key === ' '){
            e.preventDefault();
            heroFlashcard.classList.toggle('flipped');
          }
        });
        // Make it focusable
        heroFlashcard.setAttribute('tabindex', '0');
        heroFlashcard.setAttribute('role', 'button');
        heroFlashcard.setAttribute('aria-label', 'Flip flashcard to learn more');
      }

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
        addCardForm.addEventListener('submit', async (ev)=>{
          ev.preventDefault();
          const deckId = Number(addCardForm.dataset.deckId);
          const front = addCardForm.elements['front'].value.trim();
          const back = addCardForm.elements['back'].value.trim();
          if(!front || !back){ alert('Please provide both front and back'); return; }

          const decks = await loadDecks();
          const idx = decks.findIndex(d=>d.id === deckId);
          if(idx === -1){ alert('Deck not found'); return; }
          const card = { id: Date.now(), front, back };
          decks[idx].cards = decks[idx].cards || [];
          decks[idx].cards.push(card);
          saveDecks(decks);
          addCardForm.reset();
          await renderDeckDetails(deckId);
          renderDecks();
        });
      }

      // export / import handlers (if present on page)
      const exportBtn = document.getElementById('export-decks');
      const exportCsvBtn = document.getElementById('export-decks-csv');
      const importInput = document.getElementById('import-file');
      if(exportBtn){ exportBtn.addEventListener('click', async ()=> await exportDecks()); }
      if(exportCsvBtn){ exportCsvBtn.addEventListener('click', async ()=> await exportDecksCSV()); }
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
      const studyProgressText = document.getElementById('study-progress-text');
      const studyProgressInner = document.getElementById('study-progress-inner');
      const studyCardEl = document.querySelector('.study-card');

      let _study = { deckId: null, idx:0, showingBack:false, total:0 };

      function updateStudyProgress(deck){
        if(!studyProgressText || !studyProgressInner || !deck || !deck.cards) return;
        const total = deck.cards.length || 0;
        _study.total = total;
        if(!total){
          studyProgressText.textContent = '';
          studyProgressInner.style.width = '0%';
          return;
        }
        const current = _study.idx + 1;
        studyProgressText.textContent = `Card ${current} of ${total}`;
        const pct = Math.max(0, Math.min(100, (current/total)*100));
        studyProgressInner.style.width = pct + '%';
      }

      async function renderStudy(){
        const deck = await getDeckById(_study.deckId);
        if(!deck || !deck.cards || !deck.cards.length){
          alert('No cards to study');
          return;
        }
        // clamp index in case cards were deleted
        if(_study.idx >= deck.cards.length){ _study.idx = deck.cards.length - 1; }
        if(_study.idx < 0){ _study.idx = 0; }

        const card = deck.cards[_study.idx];
        studyFront.textContent = card.front;
        studyBack.textContent = card.back;
        studyFront.style.display = _study.showingBack ? 'none' : '';
        studyBack.style.display = _study.showingBack ? '' : 'none';
        updateStudyProgress(deck);
      }

      function showStudy(show, deckId){
        if(!studyView) return;
        studyView.style.display = show ? 'flex' : 'none';
        studyView.setAttribute('aria-hidden', show ? 'false' : 'true');
        const cardsList = document.getElementById('deck-cards');
        const addFormEl = document.getElementById('add-card-form');
        if(cardsList) cardsList.style.display = show ? 'none' : '';
        if(addFormEl) addFormEl.style.display = show ? 'none' : '';
        if(show){
          const deck = getDeckById(deckId);
          if(!deck || !deck.cards || !deck.cards.length){
            alert('No cards to study');
            showStudy(false);
            return;
          }
          _study = { deckId: deckId, idx:0, showingBack:false, total:deck.cards.length };
          renderStudy();
          if(studyCardEl){ studyCardEl.focus(); }
        }
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
      if(studyNext){ studyNext.addEventListener('click', ()=>{ const deck = getDeckById(_study.deckId); if(!deck || !deck.cards || !deck.cards.length) return; _study.idx = (_study.idx+1) % deck.cards.length; _study.showingBack = false; renderStudy(); }); }
      if(studyPrev){ studyPrev.addEventListener('click', ()=>{ const deck = getDeckById(_study.deckId); if(!deck || !deck.cards || !deck.cards.length) return; _study.idx = (_study.idx-1+deck.cards.length) % deck.cards.length; _study.showingBack = false; renderStudy(); }); }
      if(studyExit){ studyExit.addEventListener('click', ()=> showStudy(false)); }

      // Keyboard shortcuts for study mode
      function handleStudyKey(e){
        if(!studyView || studyView.getAttribute('aria-hidden') === 'true') return;
        // if a modal is open, ignore shortcuts
        const overlay = document.getElementById('modal-overlay');
        if(overlay && overlay.getAttribute('aria-hidden') === 'false') return;

        if(e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter'){
          e.preventDefault();
          _study.showingBack = !_study.showingBack;
          renderStudy();
        }
        if(e.key === 'ArrowRight'){
          e.preventDefault();
          const deck = getDeckById(_study.deckId);
          if(!deck || !deck.cards || !deck.cards.length) return;
          _study.idx = (_study.idx+1) % deck.cards.length;
          _study.showingBack = false;
          renderStudy();
        }
        if(e.key === 'ArrowLeft'){
          e.preventDefault();
          const deck = getDeckById(_study.deckId);
          if(!deck || !deck.cards || !deck.cards.length) return;
          _study.idx = (_study.idx-1+deck.cards.length) % deck.cards.length;
          _study.showingBack = false;
          renderStudy();
        }
        if(e.key === 'Escape'){
          e.preventDefault();
          showStudy(false);
        }
      }

      document.addEventListener('keydown', handleStudyKey);

      // Quick start card handlers
      const quickStartCards = document.querySelectorAll('.quick-start-card');
      quickStartCards.forEach(card => {
        const action = card.dataset.action;
        
        // Make cards keyboard accessible
        card.addEventListener('keydown', (e) => {
          if(e.key === 'Enter' || e.key === ' '){
            e.preventDefault();
            card.click();
          }
        });

        if(action === 'create-deck'){
          card.addEventListener('click', () => {
            showForm(true);
            // Scroll to form if needed
            const form = document.getElementById('create-deck-form');
            if(form){
              setTimeout(() => {
                form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }, 100);
            }
          });
        }
        
        if(action === 'study'){
          card.addEventListener('click', () => {
            // Navigate to decks page
            window.location.href = 'decks.html';
          });
        }
        
        if(action === 'export-import'){
          card.addEventListener('click', () => {
            const decks = loadDecks();
            if(!decks || decks.length === 0){
              showSnackbar('No decks to export. Create a deck first!', null, null, 4000);
              return;
            }
            // Show a choice: export or import
            const choice = confirm('Would you like to:\n\nOK = Export your decks\nCancel = Import decks');
            if(choice){
              exportDecks();
              showSnackbar('Decks exported successfully!', null, null, 3000);
            } else {
              // Trigger import
              const importInput = document.getElementById('import-file');
              if(importInput){
                importInput.click();
              }
            }
          });
        }
      });
    });
  }

  init();
})();
