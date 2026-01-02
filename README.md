# Flashcard Website - kd 
 - This project was created to practice building web applications while studying at the same time. 
---

## Features within Project

- Create custom flashcards (question & answer)
- Flip cards to reveal answers
- Navigate between flashcards
- Simple and clean user interface
- Flashcards can be stored locally in the browser (no login required)

---

## Coding Languages Used in Project 

- HTML
- CSS
# MindDeck Flashcards

This is a small client-side flashcards web app (minimal demo / prototype).

Overview
--------

- Create, edit and delete decks
- Add, edit and delete cards inside decks
- Undo delete for decks and cards via a snackbar
- Export and import decks as JSON
- Simple study mode: flip / next / prev / exit

How to run
----------

Serve the files from the project root (recommended):

```bash
python3 -m http.server 8000
# open http://localhost:8000 in your browser
```

Data persistence
----------------

All data is stored in the browser's localStorage under the key `wwwf_decks_v1`.

Notes & next steps
------------------

- The project uses small prompt-based editors for renaming decks and editing cards. If you prefer, I can replace those with in-page modals.
- For production you'd probably add a server API and user accounts so decks sync between devices.
- I can add spaced repetition algorithms and progress tracking if you want study features.

If you'd like, I can continue by polishing the UI, adding tests, or implementing server sync.
 
Server sync (optional)
----------------------

I added a minimal Node/Express scaffold in `server.js` that exposes:

- GET /api/decks — returns decks from `data.json` (file in repo root)
- POST /api/decks — replace decks (accepts array)
- GET /api/health — simple health check

To run the server locally:

```bash
# install dependencies once
npm install
# start server
npm start
# server runs on http://localhost:3000 by default
```

Client-side sync
-----------------
The app is still client-first (localStorage). I added a simple server scaffold and helper stubs in `app.js` so we can add push/pull sync later.
