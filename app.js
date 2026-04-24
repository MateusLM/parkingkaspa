const RECEIVING_ADDRESS = 'kaspa:qpzja5n54aa0s0qfnmreh2m55kfkntaansrnq5yazzj49kv6jzwkjke6pp2k';
const SOMPI_PER_KAS = 100_000_000;
const EXPECTED_NETWORK = 'mainnet';

const spots = [
  { id: 1, location: '123 Main St', pricePerHour: 0.05 },
  { id: 2, location: '456 Oak Ave', pricePerHour: 0.03 },
];

let walletState = { connected: false, address: null, balance: null };
let toastTimeout = null;

function checkWalletAvailable() {
  return typeof window.kasware !== 'undefined';
}

function truncateAddress(addr) {
  return addr.slice(0, 14) + '...' + addr.slice(-6);
}

function showToast(message, type) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = 'toast ' + type;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { el.classList.add('hidden'); }, 5000);
}

function renderWalletUI() {
  const bar = document.getElementById('wallet-bar');
  if (!walletState.connected) {
    bar.innerHTML =
      '<button class="connect-btn" onclick="connectWallet()">Connect Wallet</button>';
    return;
  }
  const balanceText =
    walletState.balance !== null
      ? walletState.balance.toFixed(4) + ' KAS'
      : 'Loading...';
  bar.innerHTML =
    '<span class="wallet-address">' + truncateAddress(walletState.address) + '</span>' +
    '<span class="wallet-balance">' + balanceText + '</span>' +
    '<button class="disconnect-btn" onclick="disconnectWallet()">Disconnect</button>';
}

function renderSpots() {
  const container = document.getElementById('spots');
  container.innerHTML = '';
  spots.forEach(spot => {
    const div = document.createElement('div');
    div.className = 'spot';
    const disabled = !walletState.connected ? 'disabled' : '';
    div.innerHTML =
      '<p><strong>Location:</strong> ' + spot.location + '</p>' +
      '<p><strong>Price:</strong> ' + spot.pricePerHour + ' KAS/hour</p>' +
      '<input id="hours-' + spot.id + '" type="number" min="1" value="1">' +
      '<button id="pay-btn-' + spot.id + '" onclick="pay(' + spot.id + ')" ' + disabled + '>Pay &amp; Reserve</button>' +
      (!walletState.connected ? '<p class="wallet-hint">Connect wallet to pay</p>' : '') +
      '<div id="tx-result-' + spot.id + '" class="tx-result"></div>';
    container.appendChild(div);
  });
}

async function connectWallet() {
  if (!checkWalletAvailable()) {
    showToast('KasWare wallet not detected. Install it from kasware.xyz', 'error');
    return;
  }
  try {
    const accounts = await window.kasware.requestAccounts();
    if (!accounts || accounts.length === 0) {
      showToast('No accounts returned from wallet.', 'error');
      return;
    }
    walletState.connected = true;
    walletState.address = accounts[0];
    await checkNetwork();
    await refreshBalance();
    window.kasware.on('accountsChanged', handleAccountsChanged);
    renderWalletUI();
    renderSpots();
    showToast('Wallet connected!', 'success');
  } catch (e) {
    if (e.code === 4001) {
      showToast('Wallet connection was cancelled.', 'warning');
    } else {
      showToast('Failed to connect wallet: ' + e.message, 'error');
    }
  }
}

function disconnectWallet() {
  walletState = { connected: false, address: null, balance: null };
  renderWalletUI();
  renderSpots();
  showToast('Wallet disconnected.', 'warning');
}

async function checkNetwork() {
  try {
    const network = await window.kasware.getNetwork();
    if (network !== EXPECTED_NETWORK) {
      showToast('Your wallet is on ' + network + '. Please switch to ' + EXPECTED_NETWORK + '.', 'warning');
    }
  } catch (_) {}
}

async function handleAccountsChanged(accounts) {
  if (!accounts || accounts.length === 0) {
    disconnectWallet();
    return;
  }
  walletState.address = accounts[0];
  await refreshBalance();
  renderWalletUI();
  renderSpots();
}

async function refreshBalance() {
  try {
    const balance = await window.kasware.getBalance();
    walletState.balance = (balance.total || 0) / SOMPI_PER_KAS;
    renderWalletUI();
  } catch (_) {}
}

async function pay(spotId) {
  if (!walletState.connected) {
    showToast('Please connect your wallet first.', 'error');
    return;
  }
  const spot = spots.find(s => s.id === spotId);
  const hoursInput = document.getElementById('hours-' + spotId);
  const hours = parseInt(hoursInput.value, 10);
  if (!hours || hours < 1) {
    showToast('Please enter a valid number of hours.', 'error');
    return;
  }
  const totalKAS = spot.pricePerHour * hours;
  const totalSompi = Math.round(totalKAS * SOMPI_PER_KAS);

  if (walletState.balance !== null && totalKAS > walletState.balance) {
    showToast('Insufficient KAS balance.', 'error');
    return;
  }

  const btn = document.getElementById('pay-btn-' + spotId);
  const resultDiv = document.getElementById('tx-result-' + spotId);
  btn.disabled = true;
  resultDiv.innerHTML = 'Processing... <span class="spinner"></span>';

  try {
    const txId = await window.kasware.sendKaspa(RECEIVING_ADDRESS, totalSompi);
    resultDiv.innerHTML =
      'Paid ' + totalKAS + ' KAS — Tx: <a class="tx-link" href="https://explorer.kaspa.org/txs/' + txId + '" target="_blank" rel="noopener">' + txId.slice(0, 16) + '...</a>';
    showToast('Payment successful!', 'success');
    await refreshBalance();
  } catch (e) {
    resultDiv.innerHTML = '';
    if (e.code === 4001) {
      showToast('Payment was cancelled.', 'warning');
    } else if (/insufficient/i.test(e.message || '')) {
      showToast('Insufficient funds.', 'error');
    } else {
      showToast('Payment failed: ' + (e.message || e), 'error');
    }
  } finally {
    btn.disabled = false;
  }
}

window.onload = async function () {
  renderWalletUI();
  renderSpots();
  if (checkWalletAvailable()) {
    try {
      const accounts = await window.kasware.getAccounts();
      if (accounts && accounts.length > 0) {
        walletState.connected = true;
        walletState.address = accounts[0];
        await refreshBalance();
        window.kasware.on('accountsChanged', handleAccountsChanged);
        renderWalletUI();
        renderSpots();
      }
    } catch (_) {}
  }
};
