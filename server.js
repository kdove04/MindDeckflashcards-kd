const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

function readData(){
  try{ return JSON.parse(fs.readFileSync(DATA_FILE,'utf8') || '[]'); }
  catch(e){ return []; }
}
function writeData(data){
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/decks', (req, res)=>{
  res.json(readData());
});

// replace entire decks collection
app.post('/api/decks', (req, res)=>{
  const data = req.body;
  if(!Array.isArray(data)) return res.status(400).json({error:'expected array'});
  writeData(data);
  res.json({ok:true});
});

// simple health
app.get('/api/health', (req,res)=> res.json({ok:true}));

app.listen(PORT, ()=> console.log(`MindDeck server running on http://localhost:${PORT}`));
