import { useState, useEffect } from 'react';
import { AppConfig, UserSession, authenticate as stacksAuthenticate } from '@stacks/connect';
import beanSvg from './assets/bean.svg';
import { openContractCall } from '@stacks/connect';
import { PostConditionMode } from '@stacks/transactions';

// 1. Initialize Stacks AppConfig and UserSession
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

// Stacks Contract Config
const CONTRACT_ADDRESS = 'ST15T00TRYSEM32RXVWMCNQD8QFS1B2856XR5Q43V';
const CONTRACT_NAME = 'bean-nft';
const NETWORK = 'testnet';
const API_BASE = 'https://api.testnet.hiro.so';

function App() {
  const [mounted, setMounted] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [mintedCount, setMintedCount] = useState(0);
  const [txStatus, setTxStatus] = useState<null | 'idle' | 'pending' | 'success' | 'error'>(null);
  const [txMessage, setTxMessage] = useState('');

  // Handle session restore on mount
  useEffect(() => {
    setMounted(true);
    if (userSession.isSignInPending()) {
      userSession.handlePendingSignIn().then((userData) => {
        setAddress(userData.profile.stxAddress.testnet);
      });
    } else if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      setAddress(userData.profile.stxAddress.testnet);
    }
  }, []);

  const authenticate = () => {
    stacksAuthenticate({
      appDetails: {
        name: 'BeanOnStacks',
        icon: window.location.origin + beanSvg,
      },
      redirectTo: '/',
      onFinish: () => {
        const userData = userSession.loadUserData();
        setAddress(userData.profile.stxAddress.testnet);
      },
      onCancel: () => {
        console.log('User cancelled authentication');
      },
      userSession,
    });
  };

  const disconnect = () => {
    userSession.signUserOut();
    setAddress(null);
  };

  // Fetch minted count
  const fetchMintedCount = async () => {
    try {
      const url = `${API_BASE}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-last-token-id`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: CONTRACT_ADDRESS, arguments: [] }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.okay && data.result) {
          const hexValue = data.result;
          const count = parseInt(hexValue.slice(-16), 16) || 0;
          setMintedCount(count);
        }
      }
    } catch (err) {
      console.error('Failed to fetch minted count:', err);
    }
  };

  useEffect(() => {
    fetchMintedCount();
    const interval = setInterval(fetchMintedCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const pollTransaction = async (txId: string) => {
    const url = `${API_BASE}/extended/v1/tx/${txId}`;
    let attempts = 0;
    const maxAttempts = 60; // 5 mins

    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          if (attempts >= maxAttempts) {
            clearInterval(poll);
            setTxStatus('pending');
            setTxMessage(`⏳ Still pending... Check Explorer`);
          }
          return;
        }
        const data = await res.json();

        if (data.tx_status === 'success') {
          clearInterval(poll);
          setTxStatus('success');
          setTxMessage(`✅ Minted successfully!`);
          fetchMintedCount();
        } else if (data.tx_status === 'abort_by_response' || data.tx_status === 'abort_by_post_condition') {
          clearInterval(poll);
          setTxStatus('error');
          setTxMessage(`❌ Transaction failed: ${data.tx_status}`);
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 5000);
  };

  const handleMint = async () => {
    if (!address) {
      authenticate();
      return;
    }

    setTxStatus('pending');
    setTxMessage('⏳ Waiting for wallet approval...');

    try {
      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'mint',
        functionArgs: [],
        postConditionMode: PostConditionMode.Allow,
        network: NETWORK,
        appDetails: {
          name: 'BeanOnStacks',
          icon: window.location.origin + beanSvg,
        },
        onFinish: (data) => {
          const txId = data.txId;
          setTxStatus('pending');
          setTxMessage(`⛏️ Transaction submitted! TX: ${txId.slice(0, 8)}...${txId.slice(-4)}`);
          pollTransaction(txId);
        },
        onCancel: () => {
          setTxStatus('error');
          setTxMessage('❌ Transaction cancelled by user');
        },
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Mint error:', err);
      setTxStatus('error');
      setTxMessage(`❌ ${err.message || 'Minting failed'}`);
    }
  };

  if (!mounted) return null;

  return (
    <>
      <div className="bg-particles" />
      
      <nav className="navbar">
        <div className="nav-brand">
          <span className="bean-icon">☕</span>
          <span className="brand-text">BeanOnStacks</span>
        </div>
        {address ? (
          <button className="btn btn-connect connected" onClick={disconnect}>
            {`${address.slice(0, 6)}...${address.slice(-4)}`}
          </button>
        ) : (
          <button className="btn btn-connect" onClick={authenticate}>
            Connect Wallet
          </button>
        )}
      </nav>

      <main className="main-container">
        <div className="hero-content">
          <div className="badge">🔥 LIVE ON STACKS TESTNET</div>
          <h1 className="hero-title">
            <span className="gradient-text">Bean</span>On<span className="gradient-text">Stacks</span>
          </h1>
          <p className="hero-subtitle">
            A limited edition collection of <strong>1,000 beans</strong> living on the Stacks blockchain.
            Each bean is secured by Bitcoin's proof-of-work. <strong>Max 10 per wallet.</strong>
          </p>
        </div>

        <div className="mint-section">
          {/* NFT Preview Card */}
          <div className="nft-card">
            <div className="nft-image">
              <img src={beanSvg} alt="BeanOnStacks NFT" className="bean-svg" />
            </div>
            <div className="nft-card-footer">
              <span className="collection-name">BeanOnStacks #?</span>
              <span className="network-badge">Testnet</span>
            </div>
          </div>

          {/* Mint Panel */}
          <div className="mint-panel">
            <div className="mint-stats">
              <div className="stat-item">
                <span className="stat-label">MINTED</span>
                <span className="stat-value">{mintedCount.toLocaleString()} / 1,000</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">PRICE</span>
                <span className="stat-value">1 STX</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">MAX / WALLET</span>
                <span className="stat-value">10</span>
              </div>
            </div>

            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${(mintedCount / 1000) * 100}%` }}></div>
            </div>

            <div className="wallet-status">
              <div className={`status-dot ${address ? 'connected' : 'disconnected'}`}></div>
              <span>{address ? `Connected: ${address.slice(0, 6)}...${address.slice(-4)}` : 'No wallet connected'}</span>
            </div>

            <button 
              className="btn btn-mint" 
              onClick={handleMint}
              disabled={txStatus === 'pending' || (mintedCount >= 1000)}
            >
              <span className="btn-content">
                <span className="mint-icon">⚡</span>
                {txStatus === 'pending' ? 'Processing...' : 'Mint Bean NFT'}
              </span>
            </button>

            {txStatus && (
              <div className={`tx-status ${txStatus}`}>
                {txStatus === 'pending' && <div className="tx-spinner"></div>}
                <span>{txMessage}</span>
              </div>
            )}

            <div className="mint-info">
              <p>💡 Connect using <strong>Xverse or Leather</strong> directly.</p>
              <p>Need test STX? Use the <a href="https://explorer.hiro.so/sandbox/faucet?chain=testnet" target="_blank" rel="noreferrer">Stacks Faucet</a>.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>Powered by @stacks/connect Setup</p>
      </footer>
    </>
  );
}

export default App;
