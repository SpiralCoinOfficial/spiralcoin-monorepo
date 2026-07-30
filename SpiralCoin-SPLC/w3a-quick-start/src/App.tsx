import { useWeb3AuthConnect, useWeb3AuthDisconnect, useWeb3AuthUser } from "@web3auth/modal/react";
import "./App.css";
// IMP START - Blockchain Calls
import { useAccount } from "wagmi";
import { Balance } from "./components/getBalance";
import { SendTransaction } from "./components/sendTransaction";
import { SwitchChain } from "./components/switchNetwork";
// IMP END - Blockchain Calls
function App() {
  // IMP START - Login
  const { connect, isConnected, connectorName, loading: connectLoading, error: connectError } = useWeb3AuthConnect();
  // IMP END - Login
  // IMP START - Logout
  const { disconnect, loading: disconnectLoading, error: disconnectError } = useWeb3AuthDisconnect();
  // IMP END - Logout
  const { userInfo } = useWeb3AuthUser();
  // IMP START - Blockchain Calls
  const { address } = useAccount();
  // IMP END - Blockchain Calls

  function uiConsole(...args: any[]): void {
    const el = document.querySelector("#console>p");
    if (el) {
      el.innerHTML = JSON.stringify(args || {}, null, 2);
      console.log(...args);
    }
  }

  const loggedInView = (
    <div className="grid">
      <h2>Connected to {connectorName}</h2>
      {/* // IMP START - Blockchain Calls */}
      <div>{address}</div>
      {/* // IMP END - Blockchain Calls */}
      <div className="flex-container">
        <div>
          <button onClick={() => uiConsole(userInfo)} className="card">
            Get User Info
          </button>
        </div>
        {/* // IMP START - Logout */}
        <div>
          <button onClick={() => disconnect()} className="card">
            Log Out
          </button>
          {disconnectLoading && <div className="loading">Disconnecting...</div>}
          {disconnectError && <div className="error">{disconnectError.message}</div>}
        </div>
        {/* // IMP END - Logout */}
      </div>
      {/* IMP START - Blockchain Calls */}
      <SendTransaction />
      <Balance />
      <SwitchChain />
      {/* IMP END - Blockchain Calls */}
    </div>
  );

  const unloggedInView = (
    // IMP START - Login
    <div className="grid">
      <button onClick={() => connect()} className="card">
        Login
      </button>
      {connectLoading && <div className="loading">Connecting...</div>}
      {connectError && <div className="error">{connectError.message}</div>}
    </div>
    // IMP END - Login

  );

  return (
    <div className="container">
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid rgba(201,162,39,0.28)", marginBottom: 24 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, color: "#c9a227", textDecoration: "none", fontWeight: 700 }}>
          <img src="/app/spiralcoin_logo.png" alt="SpiralCoin" width={28} height={28} />
          <span>SpiralCoin</span>
        </a>
        <a href="/" style={{ color: "#7a8fa8", textDecoration: "none", fontSize: 14 }}>← Back to site</a>
      </nav>
      <h1 className="title">SpiralCoin Web3 App</h1>
      <p style={{ textAlign: "center", color: "#7a8fa8", marginTop: -8, marginBottom: 24 }}>
        Connect a wallet or social login to access on-chain features.
      </p>

      {isConnected ? loggedInView : unloggedInView}
      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>

      <footer className="footer">
        <a href="/" rel="noopener noreferrer">spiralcoin.net</a>
        {" · "}
        Powered by <a href="https://web3auth.io" target="_blank" rel="noopener noreferrer">Web3Auth</a>
      </footer>
    </div>
  );
}

export default App;
