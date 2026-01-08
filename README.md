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

- HTML5
- CSS3
- Vanilla Javascript
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


To run the server locally:

```bash
# install dependencies once
npm install
# start server
npm start
# server runs on http://localhost:3000 by default
```


Data persistence
----------------

All data is stored in the browser's localStorage under the key `wwwf_decks_v1`.

Client-side sync
-----------------
The app is still client-first (localStorage). 
