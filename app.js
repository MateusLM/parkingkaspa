const RECEIVING_ADDRESS = 'kaspa:qpzja5n54aa0s0qfnmreh2m55kfkntaansrnq5yazzj49kv6jzwkjke6pp2k';
const SOMPI_PER_KAS = 100_000_000;
const EXPECTED_NETWORK = 'mainnet';

const spots = [
  { id: 1, location: '123 Main St',  pricePerHour: 0.05, lat: 40.7580, lng: -73.9855 },
  { id: 2, location: '456 Oak Ave',  pricePerHour: 0.03, lat: 40.7614, lng: -73.9776 },
];

let walletState = { connected: false, address: null, balance: null };
let map = null;
let markers = {};
let activeSpotId = null;

// ── SVG Icons ──

var ICON = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  check: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
  error: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
  warning: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
};

// ── Utilities ──

function checkWalletAvailable() {
  return typeof window.kasware !== 'undefined';
}

function truncateAddress(addr) {
  return addr.slice(0, 14) + '...' + addr.slice(-6);
}

// ── Toast System ──

function showToast(message, type) {
  var container = document.getElementById('toast-container');
  var iconMap = { success: ICON.check, error: ICON.error, warning: ICON.warning };
  var toast = document.createElement('div');
  toast.className = 'toast toast--' + type;
  toast.innerHTML =
    '<span class="toast__icon">' + (iconMap[type] || '') + '</span>' +
    '<span class="toast__message">' + message + '</span>' +
    '<button class="toast__close" onclick="dismissToast(this.parentElement)">&times;</button>';
  container.appendChild(toast);
  setTimeout(function () { dismissToast(toast); }, 5000);
}

function dismissToast(el) {
  if (!el || !el.parentElement) return;
  el.classList.add('toast--exit');
  setTimeout(function () { el.remove(); }, 300);
}

// ── Map ──

function initMap() {
  var centerLat = spots.reduce(function (s, sp) { return s + sp.lat; }, 0) / spots.length;
  var centerLng = spots.reduce(function (s, sp) { return s + sp.lng; }, 0) / spots.length;

  map = L.map('map', { zoomControl: true }).setView([centerLat, centerLng], 15);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  spots.forEach(function (spot) {
    var icon = createMarkerIcon(false);
    var marker = L.marker([spot.lat, spot.lng], { icon: icon })
      .addTo(map)
      .bindPopup('<strong>' + spot.location + '</strong><br>' + spot.pricePerHour + ' KAS/hr');
    marker.on('click', function () { selectSpot(spot.id); });
    markers[spot.id] = marker;
  });

  setTimeout(function () { map.invalidateSize(); }, 150);
}

function createMarkerIcon(active) {
  return L.divIcon({
    className: 'marker-wrapper',
    html: '<div class="marker-icon' + (active ? ' marker-icon--active' : '') +
          '"><div class="marker-icon__label">P</div></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

function selectSpot(spotId) {
  if (activeSpotId === spotId) return;
  if (activeSpotId !== null) {
    var prevCard = document.getElementById('spot-card-' + activeSpotId);
    if (prevCard) prevCard.classList.remove('spot-card--active');
    if (markers[activeSpotId]) markers[activeSpotId].setIcon(createMarkerIcon(false));
  }
  activeSpotId = spotId;
  var card = document.getElementById('spot-card-' + spotId);
  if (card) {
    card.classList.add('spot-card--active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  if (markers[spotId]) markers[spotId].setIcon(createMarkerIcon(true));
  var spot = spots.find(function (s) { return s.id === spotId; });
  if (spot && map) map.panTo([spot.lat, spot.lng], { animate: true });
}

// ── Wallet UI ──

function renderWalletUI() {
  var bar = document.getElementById('wallet-bar');
  if (!walletState.connected) {
    bar.innerHTML =
      '<button class="wallet-connect-btn" onclick="connectWallet()">' +
        ICON.wallet + ' Connect Wallet</button>';
    return;
  }
  var balanceText = walletState.balance !== null
    ? walletState.balance.toFixed(4) + ' KAS'
    : '...';
  bar.innerHTML =
    '<div class="wallet-pill">' +
      '<span class="wallet-pill__address">' + truncateAddress(walletState.address) + '</span>' +
      '<span class="wallet-pill__balance">' + balanceText + '</span>' +
      '<button class="wallet-pill__disconnect" onclick="disconnectWallet()" title="Disconnect">&times;</button>' +
    '</div>';
}

// ── Spot Cards ──

function renderSpots() {
  var container = document.getElementById('spots');
  container.innerHTML = '';
  document.getElementById('spots-count').textContent = spots.length + ' spot' + (spots.length !== 1 ? 's' : '');

  spots.forEach(function (spot) {
    var div = document.createElement('div');
    div.className = 'spot-card' + (activeSpotId === spot.id ? ' spot-card--active' : '');
    div.id = 'spot-card-' + spot.id;
    div.onclick = function (e) {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('button')) return;
      selectSpot(spot.id);
    };

    var disabled = !walletState.connected ? 'disabled' : '';
    var totalKAS = (spot.pricePerHour * 1).toFixed(4);

    div.innerHTML =
      '<div class="spot-card__header">' +
        '<div class="spot-card__location">' + ICON.pin + spot.location + '</div>' +
        '<span class="spot-card__price-badge">' + spot.pricePerHour + ' KAS/hr</span>' +
      '</div>' +
      '<div class="spot-card__body">' +
        '<div class="spot-card__hours-row">' +
          '<span class="spot-card__label">Duration</span>' +
          '<div class="spot-card__hours-control">' +
            '<button class="spot-card__hours-btn" onclick="adjustHours(' + spot.id + ',-1)">−</button>' +
            '<input id="hours-' + spot.id + '" class="spot-card__hours-input" type="number" min="1" value="1" oninput="updateTotal(' + spot.id + ')">' +
            '<button class="spot-card__hours-btn" onclick="adjustHours(' + spot.id + ',1)">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="spot-card__total" id="total-' + spot.id + '">Total: ' + totalKAS + ' KAS</div>' +
      '</div>' +
      '<div class="spot-card__footer">' +
        (!walletState.connected
          ? '<div class="spot-card__wallet-overlay">' + ICON.lock + '<span>Connect wallet to reserve</span></div>'
          : '') +
        '<button id="pay-btn-' + spot.id + '" class="spot-card__pay-btn" onclick="pay(' + spot.id + ')" ' + disabled + '>Pay &amp; Reserve</button>' +
        '<div id="tx-result-' + spot.id + '" class="spot-card__tx-result"></div>' +
      '</div>';

    container.appendChild(div);
  });
}

function adjustHours(spotId, delta) {
  var input = document.getElementById('hours-' + spotId);
  var val = Math.max(1, parseInt(input.value || '1', 10) + delta);
  input.value = val;
  updateTotal(spotId);
}

function updateTotal(spotId) {
  var input = document.getElementById('hours-' + spotId);
  var hours = Math.max(1, parseInt(input.value || '1', 10));
  var spot = spots.find(function (s) { return s.id === spotId; });
  document.getElementById('total-' + spotId).textContent = 'Total: ' + (spot.pricePerHour * hours).toFixed(4) + ' KAS';
}

// ── Wallet Connection ──

async function connectWallet() {
  if (!checkWalletAvailable()) {
    showToast('KasWare wallet not detected. Install it from kasware.xyz', 'error');
    return;
  }
  try {
    var accounts = await window.kasware.requestAccounts();
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
    var network = await window.kasware.getNetwork();
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
    var balance = await window.kasware.getBalance();
    walletState.balance = (balance.total || 0) / SOMPI_PER_KAS;
    renderWalletUI();
  } catch (_) {}
}

// ── Payment ──

async function pay(spotId) {
  if (!walletState.connected) {
    showToast('Please connect your wallet first.', 'error');
    return;
  }
  var spot = spots.find(function (s) { return s.id === spotId; });
  var hoursInput = document.getElementById('hours-' + spotId);
  var hours = parseInt(hoursInput.value, 10);
  if (!hours || hours < 1) {
    showToast('Please enter a valid number of hours.', 'error');
    return;
  }
  var totalKAS = spot.pricePerHour * hours;
  var totalSompi = Math.round(totalKAS * SOMPI_PER_KAS);

  if (walletState.balance !== null && totalKAS > walletState.balance) {
    showToast('Insufficient KAS balance.', 'error');
    return;
  }

  var btn = document.getElementById('pay-btn-' + spotId);
  var resultDiv = document.getElementById('tx-result-' + spotId);
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Processing...';

  try {
    var txId = await window.kasware.sendKaspa(RECEIVING_ADDRESS, totalSompi);
    resultDiv.innerHTML =
      'Paid ' + totalKAS.toFixed(4) + ' KAS — <a class="tx-link" href="https://explorer.kaspa.org/txs/' + txId + '" target="_blank" rel="noopener">View transaction</a>';
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
    btn.disabled = !walletState.connected;
    btn.textContent = 'Pay & Reserve';
  }
}

// ── Init ──

window.onload = async function () {
  initMap();
  renderWalletUI();
  renderSpots();

  if (checkWalletAvailable()) {
    try {
      var accounts = await window.kasware.getAccounts();
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

window.addEventListener('resize', function () {
  if (map) map.invalidateSize();
});
