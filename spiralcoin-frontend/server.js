import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import cors from 'cors';
import { dqveUpdate } from './dqve.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 8080;
const POLL_MS = Math.max(200, Number(process.env.POLL_MS || 1000));
const PUSH_MS = Math.max(20, Number(process.env.PUSH_MS || 200));
const SPRC_BASE_URL = process.env.SPRC_BASE_URL || 'https://spiralcoin.net/api/splc';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let splc = { price: 0, marketCap: 0 };
let btc = { price: 0 };
let eth = { price: 0 };

async function fetchSPRCBase() {
  try {
    const r = await axios.get(SPRC_BASE_URL);
    if (r.data.price) splc.price = dqveUpdate(splc.price, r.data.price);
    if (r.data.marketCap) splc.marketCap = dqveUpdate(splc.marketCap, r.data.marketCap);
  } catch (err) { console.log("SPRC fetch fail"); }
}

async function fetchCryptoPrices() {
  try {
    const r = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
      params: { ids: 'bitcoin,ethereum', vs_currencies: 'usd' }
    });
    btc.price = dqveUpdate(btc.price, r.data.bitcoin.usd);
    eth.price = dqveUpdate(eth.price, r.data.ethereum.usd);
  } catch (err) { console.log("Crypto fetch fail"); }
}

setInterval(() => {
  fetchSPRCBase();
  fetchCryptoPrices();
}, POLL_MS);

fetchSPRCBase();
fetchCryptoPrices();

app.get('/api/splc', (req, res) => res.json(splc));
app.get('/api/crypto', (req, res) => res.json({ bitcoin: btc.price, ethereum: eth.price }));

app.get('/sse/splc', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();
  const send = () => {
    res.write(`data: ${JSON.stringify({
      price: splc.price,
      marketCap: splc.marketCap,
      bitcoin: btc.price,
      ethereum: eth.price,
      ts: Date.now()
    })}\n\n`);
  };
  send();
  const iv = setInterval(send, PUSH_MS);
  req.on('close', () => clearInterval(iv));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () =>
  console.log(`🚀 SpiralCoin frontend running at http://0.0.0.0:${PORT}`)
);
