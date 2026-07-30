async function loadBalance() {
  const wallet = document.getElementById("tradeWallet").value;
  if (!wallet) return;
  try {
    const res = await axios.get(`/api/getBalance?address=${wallet}`);
    document.getElementById("walletBalance").innerText = "Balance: " + res.data.balance + " SPRC";
  } catch (err) {
    console.error("Error fetching balance:", err);
    document.getElementById("walletBalance").innerText = "Balance: Error";
  }
}

document.getElementById("tradeWallet").addEventListener("change", loadBalance);
loadBalance();

async function doBuy() {
  const wallet = document.getElementById("tradeWallet").value;
  const amount = Number(document.getElementById("tradeAmount").value);
  if (!wallet || !amount) return alert("Enter wallet and amount");
  try {
    const res = await axios.post("/api/sendTransaction", { from: wallet, to: "0xExchangeWallet", amount });
    alert("Transaction successful: " + res.data.txID);
    loadBalance();
  } catch (err) {
    alert("Transaction failed");
  }
}

async function doSell() {
  const wallet = document.getElementById("tradeWallet").value;
  const amount = Number(document.getElementById("tradeAmount").value);
  if (!wallet || !amount) return alert("Enter wallet and amount");
  try {
    const res = await axios.post("/api/sendTransaction", { from: wallet, to: "0xBuyerWallet", amount });
    alert("Transaction successful: " + res.data.txID);
    loadBalance();
  } catch (err) {
    alert("Transaction failed");
  }
}

async function doMine() {
  const wallet = document.getElementById("tradeWallet").value;
  if (!wallet) return alert("Enter wallet");
  try {
    const res = await axios.post("/api/mineBlock", { miner: wallet });
    alert("Mining successful: Block " + res.data.blockNumber);
    loadBalance();
  } catch (err) {
    alert("Mining failed");
  }
}
