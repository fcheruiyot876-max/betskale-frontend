const API_URL = 'https://api.betskale.com'; // CHANGE TO YOUR BACKEND URL
const SUPPORTED_COINS = ['usdttrc20','usdterc20','usdc','btc','eth','sol','bnb','lite','tron'];
let slip = [];
let token = localStorage.getItem('betskale_token');
let currentSport = 'soccer_epl';

// ===== UTILS =====
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const closeModal = id => $(`#${id}`).classList.remove('open');
const openModal = id => $(`#${id}`).classList.add('open');

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

// ===== AUTH =====
function updateAuthUI() {
  if (token) {
    $('#authBox').innerHTML = `<button onclick="openModal('walletModal');loadWallet()">Wallet</button><button onclick="logout()">Logout</button>`;
    $('#walletMini').style.display = 'block';
    loadWallet();
  } else {
    $('#authBox').innerHTML = `<button id="loginBtn">Login</button><button id="registerBtn" class="primary">Register</button>`;
    $('#loginBtn').onclick = () => openAuth(false);
    $('#registerBtn').onclick = () => openAuth(true);
    $('#walletMini').style.display = 'none';
  }
}

function openAuth(isReg = false) {
  openModal('authModal');
  $('#authTitle').textContent = isReg? 'Register' : 'Login';
  $('#authToggle').textContent = isReg? 'Have an account? Login' : 'Need an account? Register';
  $('#authSubmit').onclick = isReg? register : login;
  $('#authError').textContent = '';
}
$('#authToggle').onclick = () => openAuth($('#authTitle').textContent === 'Login');

async function login() {
  const email = $('#authEmail').value, password = $('#authPass').value;
  const res = await fetch(API_URL + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.ok) { localStorage.setItem('betskale_token', data.token); token = data.token; closeModal('authModal'); updateAuthUI(); loadMatches(); }
  else $('#authError').textContent = data.error;
}

async function register() {
  const email = $('#authEmail').value, password = $('#authPass').value;
  const res = await fetch(API_URL + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.ok) { localStorage.setItem('betskale_token', data.token); token = data.token; closeModal('authModal'); updateAuthUI(); loadMatches(); }
  else $('#authError').textContent = data.error;
}

function logout() { localStorage.clear(); token = null; updateAuthUI(); loadMatches(); }

// ===== MATCHES =====
async function loadMatches() {
  $('#matchList').innerHTML = '<div class="loader">Loading matches...</div>';
  const res = await fetch(`${API_URL}/api/odds?sport=${currentSport}`);
  const data = await res.json();
  $('#modeBadge').textContent = data.mode === 'real'? 'REAL MONEY - CRYPTO' : 'DEMO MODE';
  if (!data.matches?.length) { $('#matchList').innerHTML = '<div class="loader">No matches available</div>'; return; }
  $('#matchList').innerHTML = data.matches.map(m => `
    <div class="match-card">
      <div class="match-meta"><span>⚽ ${m.league}</span><span>${formatDate(m.time)}</span></div>
      <div class="match-row">
        <div class="teams">${m.home}<br>${m.away}</div>
        <button class="odd-btn" onclick="addToSlip('${m.id}','${m.home}','${m.away}','${m.home}',${m.odds[0]||0})">${m.odds[0]?.toFixed(2) || '-'}</button>
        <button class="odd-btn" onclick="addToSlip('${m.id}','${m.home}','${m.away}','Draw',${m.odds[2]||0})">${m.odds[2]?.toFixed(2) || '-'}</button>
        <button class="odd-btn" onclick="addToSlip('${m.id}','${m.home}','${m.away}','${m.away}',${m.odds[1]||0})">${m.odds[1]?.toFixed(2) || '-'}</button>
      </div>
    </div>`).join('');
}

$$('.filter-btn').forEach(btn => {
  btn.onclick = () => {
    $$('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSport = btn.dataset.sport;
    loadMatches();
  };
});

// ===== BET SLIP =====
window.addToSlip = (matchId, home, away, pick, odd) => {
  if (!odd) return;
  const id = `${matchId}_${pick}`;
  if (slip.find(s => s.id === id)) return;
  slip.push({ id, matchId, match: `${home} vs ${away}`, pick, odd });
  $('#slipCount').textContent = slip.length;
  event.target.classList.add('selected');
}

function renderSlip() {
  const totalOdds = slip.reduce((a, s) => a * s.odd, 1);
  const stake = Number($('#stakeInput').value) || 0;
  $('#slipCountModal').textContent = slip.length;
  $('#totalOdds').textContent = totalOdds.toFixed(2);
  $('#potentialWin').textContent = '$' + (stake * totalOdds).toFixed(2);
  $('#slipItems').innerHTML = slip.length? slip.map((s, i) => `
    <div class="slip-item">
      <div><b>${s.pick}</b><br><small>${s.match}</small></div>
      <div>${s.odd.toFixed(2)} <button class="remove" onclick="removeSlip(${i})">✕</button></div>
    </div>`).join('') : '<p style="text-align:center;color:#fff6">No selections</p>';
  $('#placeBetBtn').disabled = slip.length === 0 || stake <= 0;
}

window.removeSlip = i => { slip.splice(i, 1); renderSlip(); $('#slipCount').textContent = slip.length; }
$('#stakeInput').oninput = renderSlip;

async function placeBet() {
  if (!token) return openAuth();
  const stake = Number($('#stakeInput').value);
  if (!stake || slip.length === 0) return;
  const btn = $('#placeBetBtn');
  btn.disabled = true; btn.textContent = 'Placing...';
  const res = await fetch(API_URL + '/api/bets/place', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ stake, selections: slip })
  });
  const data = await res.json();
  if (res.ok) {
    alert(`Bet placed! Potential win: $${data.bet.potential_win}`);
    slip = []; $('#stakeInput').value = ''; closeModal('slipModal'); renderSlip(); $('#slipCount').textContent = 0;
    loadWallet();
  } else alert(data.error);
  btn.disabled = false; btn.textContent = 'Place Bet';
}

// ===== WALLET =====
async function loadWallet() {
  if (!token) return;
  const res = await fetch(API_URL + '/api/wallet', { headers: { 'Authorization': 'Bearer ' + token } });
  const w = await res.json();
  $('#realBal').textContent = w.balance_usd;
  $('#demoBal').textContent = w.demo_coins;
  $('#balMini').textContent = w.balance_usd;
}

function initWalletModal() {
  $('#depCoin').innerHTML = SUPPORTED_COINS.map(c => `<option value="${c}">${c.toUpperCase()}</option>`).join('');
  $('#withCoin').innerHTML = SUPPORTED_COINS.map(c => `<option value="${c}">${c.toUpperCase()}</option>`).join('');
  $$('.tab').forEach(t => t.onclick = () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    $$('.tab-content').forEach(x => x.style.display = 'none');
    t.classList.add('active');
    $(`#${t.dataset.tab}Tab`).style.display = 'block';
    if (t.dataset.tab === 'history') loadTxHistory();
  });
}

async function createDeposit() {
  const amount = $('#depAmount').value, currency = $('#depCoin').value;
  const res = await fetch(API_URL + '/api/payments/crypto/deposit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ amount: Number(amount), currency })
  });
  const data = await res.json();
  if (res.ok) $('#depResult').innerHTML = `<p>Send <b>${data.pay_amount} ${data.pay_currency.toUpperCase()}</b> to:</p><p style="word-break:break-all;background:#1C2029;padding:8px;border-radius:8px;margin:8px 0">${data.pay_address}</p><a href="${data.invoice_url}" target="_blank">Open Invoice Page</a>`;
  else alert(data.error);
}

async function createWithdraw() {
  const amount = $('#withAmount').value, currency = $('#withCoin').value, address = $('#withAddr').value;
  const res = await fetch(API_URL + '/api/payments/crypto/withdraw', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ amount: Number(amount), currency, address })
  });
  const data = await res.json();
  alert(data.msg || data.error);
  if (res.ok) loadWallet();
}

async function startKYC() {
  const res = await fetch(API_URL + '/api/kyc/start', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
  const data = await res.json();
  if (res.ok) window.open(data.kyc_url, '_blank');
  else alert(data.error);
}

async function loadTxHistory() {
  // Simplified - you'd create a /api/transactions endpoint
  $('#txHistory').innerHTML = '<p style="color:#fff6">Transaction history coming soon</p>';
}

// ===== MY BETS =====
async function loadMyBets() {
  // Simplified - you'd create a /api/bets/my endpoint
  $('#myBetsList').innerHTML = '<p style="color:#fff6">Bet history coming soon</p>';
}

// ===== NAV =====
$$('.nav-item').forEach(item => {
  item.onclick = () => {
    $$('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const page = item.dataset.page;
    if (page === 'wallet') { openModal('walletModal'); loadWallet(); }
    if (page === 'bets') { openModal('betsModal'); loadMyBets(); }
    if (page === 'profile') alert('Profile coming soon');
  };
});
$('.slip').onclick = () => { openModal('slipModal'); renderSlip(); };

// ===== INIT =====
async function init() {
  updateAuthUI();
  initWalletModal();
  const licRes = await fetch(API_URL + '/api/licenses');
  const lic = await licRes.json();
  $('#licenseFooter').textContent = `Licensed: ${lic.license}`;
  loadMatches();
}
init();
