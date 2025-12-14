/*************************

Firebase Initialization
*************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";
import {
getDatabase, ref, child, get, set, update, push, runTransaction, onValue
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const firebaseConfig = {
apiKey: "AIzaSyB_84BFLI-5iMOTwDUepXKUmDQgK4csZFk",
authDomain: "lenden-d2bc9.firebaseapp.com",
databaseURL: "https://lenden-d2bc9-default-rtdb.firebaseio.com",
projectId: "lenden-d2bc9",
storageBucket: "lenden-d2bc9.firebasestorage.app",
messagingSenderId: "258159170143",
appId: "1:258159170143:web:97e3f7acaa6d2fdaa001ea",
measurementId: "G-V6TRPK7XET"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

/*************************

Helpers
*************************/
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const formatCurrency = (n) => {
const num = Number(n || 0);
return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num)+'';
};

const todayStr = () => {
const d = new Date();
const dd = String(d.getDate()).padStart(2, '0');
const mm = String(d.getMonth()+1).padStart(2, '0');
const yyyy = d.getFullYear();
return `${dd}/${mm}/${yyyy}`;
};

const ymdToEpoch = (ymd) => {
if (!ymd) return null;
const dt = new Date(ymd + 'T00:00:00');
return dt.getTime();
};

const ddmmyyyyToEpoch = (dmy) => {
const [dd, mm, yyyy] = (dmy||'').split('/').map(Number);
if (!dd || !mm || !yyyy) return 0;
// Note: Month is 0-indexed in JS Date object
return new Date(yyyy, mm-1, dd).getTime();
};

const epochToDmy = (t) => {
const d = new Date(t);
const dd = String(d.getDate()).padStart(2, '0');
const mm = String(d.getMonth()+1).padStart(2, '0');
const yyyy = d.getFullYear();
return `${dd}/${mm}/${yyyy}`;
};

const notify = (el, msg, type='info') => {
el.textContent = msg;
el.classList.remove('err','ok','warn');
el.classList.add(type === 'error' ? 'err' : type === 'success' ? 'ok' : 'warn');
if (!msg) el.classList.remove('err','ok','warn');
};

const getAutoFilterDates = () => {
    const today = new Date();
    // এই মাসের ৩০ তারিখ থেকে গণনা শুরু হবে
    let start = new Date(today.getFullYear(), today.getMonth(), 30); 

    if (today.getDate() < 30) {
        // যদি মাসের ৩০ তারিখের আগে হয়, তবে গত মাসের ৩০ তারিখ থেকে শুরু হবে
        start = new Date(today.getFullYear(), today.getMonth() - 1, 30);
    }
    
    // শেষ তারিখ হবে বর্তমান তারিখ
    const end = new Date();

    const formatYmd = (d) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth()+1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${yyyy}-${mm}-${dd}`;
    };
    
    const formatDmy = (d) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth()+1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };

    return {
        startEpoch: start.getTime(),
        endEpoch: end.getTime(),
        startDmy: formatDmy(start),
        endDmy: formatDmy(end),
        fromYmd: formatYmd(start),
        toYmd: formatYmd(end),
    };
};

/*************************
AUTH & SESSION LOGIC (NEW)
*************************/

// NEW: Auth UI Elements
const mainAppEl = $('#main-app');
const loginModal = $('#login-modal');
const usernameInput = $('#usernameInput');
const passwordInput = $('#passwordInput');
const loginBtn = $('#loginBtn');
const loginMsg = $('#loginMsg');
const profileArea = $('#profile-area');
const profileDropdown = $('#profile-dropdown');
const profileImageContainer = $('#profile-image');
const profileImgElement = $('#profile-img-element');
const profileNameEl = $('#profile-name');
const profileUsernameDisplay = $('#profile-username-display');
const logoutBtn = $('#logoutBtn');
const profileIconPlaceholder = $('#profile-icon-placeholder');

// NEW: Re-auth Elements
const reauthModal = $('#reauth-modal');
const reauthUsernameEl = $('#reauth-username');
const reauthPasswordInput = $('#reauthPasswordInput');
const reauthBtn = $('#reauthBtn');
const reauthMsg = $('#reauthMsg');
const reauthImageContainer = $('#reauth-image-container');


// NEW: Session Management Constants
const SESSION_KEY = 'lenden_session';
const LAST_ACTIVITY_KEY = 'lenden_last_activity';
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

let CURRENT_USER = null; // Stores logged in user data
let INACTIVITY_TIMER = null; // Timer for re-auth check

function saveSession(username, userData) {
    const sessionData = {
        username: username,
        ...userData
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    updateActivityTime();
    CURRENT_USER = sessionData;
}

function getSession() {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    CURRENT_USER = null;
    // Clear UI on logout
    showLogin();
    updateProfileUI(null);
    if (INACTIVITY_TIMER) clearInterval(INACTIVITY_TIMER);
}

function updateActivityTime() {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now());
}

function showLogin() {
    // Hide main app content
    mainAppEl.classList.add('hidden');
    // Show login modal
    loginModal.classList.remove('hidden');
    // Hide reauth modal
    reauthModal.classList.add('hidden');
    // Hide bottom nav 
    $('.bottom-nav')?.classList.add('hidden'); 
    
    // Reset inputs
    usernameInput.value = '';
    passwordInput.value = '';
    notify(loginMsg, '');
    
    // Re-enable login button
    loginBtn.disabled = false;
    loginBtn.textContent = 'লগইন';
}

function showApp() {
    // Show main app content
    mainAppEl.classList.remove('hidden');
    // Hide modals
    loginModal.classList.add('hidden');
    reauthModal.classList.add('hidden');
    // Show bottom nav
    $('.bottom-nav')?.classList.remove('hidden');

    // Start background watchers
    setupInactivityWatcher();
    
    // Load app data
    loadAccounts();
    loadDashboardData(); 
    showTab('home');
    updateActivityTime();
}

function updateProfileUI(user) {
    if (user && user.image) {
        // Replace icon with image
        profileIconPlaceholder.style.display = 'none';
        
        // Create <img> element for titlebar if it's not present
        let imgEl = profileArea.querySelector('#titlebar-profile-img');
        if (!imgEl) {
            imgEl = document.createElement('img');
            imgEl.id = 'titlebar-profile-img';
            imgEl.style.width = '100%'; 
            imgEl.style.height = '100%'; 
            imgEl.style.objectFit = 'cover';
            imgEl.style.borderRadius = '50%';
            profileArea.appendChild(imgEl);
        }
        imgEl.src = user.image;

        // Update dropdown info
        profileImgElement.src = user.image;
        profileNameEl.textContent = user.name || 'ইউজার';
        profileUsernameDisplay.textContent = user.username;
        
    } else {
        // Show default icon
        profileIconPlaceholder.style.display = 'block';
        profileArea.querySelector('#titlebar-profile-img')?.remove();
        // Clear dropdown info
        profileImgElement.src = '';
        profileNameEl.textContent = '';
        profileUsernameDisplay.textContent = '';
        profileDropdown.classList.add('hidden');
    }
}


async function checkAuthStatus() {
    const session = getSession();
    if (session) {
        const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
        const now = Date.now();
        const inactiveDuration = now - lastActivity;

        if (inactiveDuration > INACTIVITY_TIMEOUT_MS) {
            // Re-auth required
            CURRENT_USER = session;
            updateProfileUI(CURRENT_USER);
            showReauthModal();
        } else {
            // Session is valid
            CURRENT_USER = session;
            updateProfileUI(CURRENT_USER);
            showApp();
        }
    } else {
        // No session, show login
        showLogin();
    }
}

function setupInactivityWatcher() {
    // Clear any existing timer
    if (INACTIVITY_TIMER) clearInterval(INACTIVITY_TIMER);

    // Watch for activity to update time
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'];
    activityEvents.forEach(event => document.addEventListener(event, updateActivityTime));

    // Start re-auth check timer (checks every 30 seconds)
    INACTIVITY_TIMER = setInterval(() => {
        if (CURRENT_USER && reauthModal.classList.contains('hidden')) {
            const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
            const now = Date.now();
            if (now - lastActivity > INACTIVITY_TIMEOUT_MS) {
                // If main app is visible and timeout occurs, show re-auth
                if (!mainAppEl.classList.contains('hidden')) {
                    showReauthModal();
                }
            }
        }
    }, 30000); // Check every 30 seconds
}

function showReauthModal() {
    if (!CURRENT_USER) return;
    
    // Hide main app
    mainAppEl.classList.add('hidden');
    // Show reauth modal
    reauthModal.classList.remove('hidden');
    // Hide bottom nav
    $('.bottom-nav')?.classList.add('hidden'); 

    // Update UI
    reauthUsernameEl.textContent = CURRENT_USER.username;
    reauthPasswordInput.value = '';
    notify(reauthMsg, '');
    
    // Update profile image in re-auth modal
    reauthImageContainer.innerHTML = `<img src="${CURRENT_USER.image || ''}" alt="Profile">`;
    
    reauthBtn.disabled = false;
    reauthBtn.textContent = 'সাবমিট';
}

async function verifyCredentials(username, password) {
    const snap = await get(child(ref(db, 'user'), username));
    if (snap.exists()) {
        const userData = snap.val();
        if (userData.password === password) {
            // Success
            return {
                name: userData.name,
                image: userData.image,
                role: userData.role
            };
        }
    }
    return null; // Failure
}


// Event Handlers for Login/Re-auth

loginBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    if (!username || !password) {
        notify(loginMsg, 'ইউজারনেম ও পাসওয়ার্ড দিন', 'error');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'প্রসেসিং...';

    const userData = await verifyCredentials(username, password);

    if (userData) {
        saveSession(username, userData);
        updateProfileUI(CURRENT_USER);
        notify(loginMsg, 'সফলভাবে লগইন হয়েছে', 'success');
        
        // Wait briefly for UI update then show app
        setTimeout(showApp, 500); 
    } else {
        notify(loginMsg, 'ইউজারনেম বা পাসওয়ার্ড ভুল হয়েছে', 'error');
        loginBtn.disabled = false;
        loginBtn.textContent = 'লগইন';
    }
});

reauthBtn.addEventListener('click', async () => {
    const username = CURRENT_USER.username;
    const password = reauthPasswordInput.value;
    
    if (!password) {
        notify(reauthMsg, 'পাসওয়ার্ড দিন', 'error');
        return;
    }

    reauthBtn.disabled = true;
    reauthBtn.textContent = 'প্রসেসিং...';

    const userData = await verifyCredentials(username, password);

    if (userData) {
        // Re-authentication successful, update activity time and show app
        updateActivityTime();
        notify(reauthMsg, 'সফলভাবে যাচাই করা হয়েছে', 'success');
        setTimeout(showApp, 500); 
    } else {
        notify(reauthMsg, 'পাসওয়ার্ড ভুল হয়েছে', 'error');
        reauthBtn.disabled = false;
        reauthBtn.textContent = 'সাবমিট';
    }
});

// Profile Dropdown Toggle/Original Help Link Handler
profileArea.addEventListener('click', (e) => {
    // If not logged in, execute original help link logic
    if (!CURRENT_USER) {
        window.location.href = "https://wa.me/8801799563159"; // Original help link
        return;
    }
    
    // Logged in: toggle profile dropdown
    profileDropdown.classList.toggle('hidden');
    e.stopPropagation(); // Prevent document click from closing it immediately
});

// Close dropdown when clicking anywhere else
document.addEventListener('click', (e) => {
    if (!profileDropdown.classList.contains('hidden') && !profileArea.contains(e.target) && !profileDropdown.contains(e.target)) {
        profileDropdown.classList.add('hidden');
    }
});


// Logout Handler
logoutBtn.addEventListener('click', () => {
    clearSession();
    profileDropdown.classList.add('hidden');
});

/*************************
State
*************************/
let ACCOUNTS = {}; // {accountNo: { Balance: number, ... }}
let ACCOUNT_LIST = []; // [accountNo]
let ALL_SINGLE_TXNS = []; // single_transaction থেকে লোড করা সব ডেটা
let ALL_CASH_IN = []; // cash থেকে লোড করা সব ডেটা
let ALL_CASH_OUT = []; // cashout থেকে লোড করা সব ডেটা

// --- NEW STATE ---
let RATES = { bdt: 0, perak_bdt: 0 }; // Firebase থেকে লোড করা রেট
let SELECTED_RATE_KEY = 'bdt'; // ডিফল্ট Johor (bdt)
let SELECTED_SERVICE = 'বিকাশ'; // ডিফল্ট বিকাশ
// --- END NEW STATE ---


function getTotalBalance(){
    return ACCOUNT_LIST.reduce((s,a)=> s + Number(ACCOUNTS?.[a]?.Balance || 0), 0);
}

// ⭐ Dashboard State
let DASHBOARD_STATE = {
    todayTxnCount: 0, todayTxnAmount: 0,
    yesterdayTxnCount: 0, yesterdayTxnCount: 0,
    last15TxnCount: 0, last15TxnAmount: 0,
    monthlyTxnCount: 0, monthlyTxnAmount: 0,
    monthlyCashIn: 0,
    monthlyCashOut: 0,
    monthlyStartDmy: '', monthlyEndDmy: '',
    last15StartDmy: '', last15EndDmy: ''
};

/*************************

UI: Tabs / Sections
*************************/
const sections = {
home: ['#section-profile', '#section-dashboard', '#section-accounts'],
send: ['#section-send'],
txns: ['#section-transactions'],
alltxns: ['#section-alltransactions'],
cashin: ['#section-cashin-history'],
cashout: ['#section-cashout-history']
};

function hideAllSections(){
['#section-profile','#section-dashboard','#section-accounts','#section-send','#section-transactions','#section-alltransactions', '#section-cashin-history', '#section-cashout-history'].forEach(id=>{
const el = $(id); if(el) el.classList.add('hidden');
});
$$('.nav .nbtn').forEach(b=>b.classList.remove('active'));
}

function showTab(tab){
hideAllSections();
(sections[tab]||[]).forEach(id=>$(id).classList.remove('hidden'));
if (tab==='home') $('#navHome')?.classList.add('active');
if (tab==='send') $('#navSend')?.classList.add('active');
if (tab==='txns') $('#navTxns')?.classList.add('active');
// special: when opening send or txns, ensure data up-to-date
if (tab==='send') rebuildSendRowsIfEmpty();
if (tab==='alltxns') loadAllAggregateTransactions();
if (tab==='txns') loadAllTransactions();
if (tab==='home') loadDashboardData(); // হোম ট্যাবে আসলে ড্যাশবোর্ড লোড হবে
}

$('#navHome')?.addEventListener('click', ()=>showTab('home'));
$('#navSend')?.addEventListener('click', ()=>showTab('send'));
$('#navTxns')?.addEventListener('click', ()=>showTab('txns'));

$('#btnAllTxns')?.addEventListener('click', ()=>{
showTab('alltxns');
});

// 'পেছনে যান' বাটনের কার্যকারিতা
$('#backHomeBtn')?.addEventListener('click', ()=>{
// সকল ইনপুট ও ডিসপ্লে ক্লিয়ার
$('#sendRows').innerHTML='';
updateServiceAndTotals();
$('#displayBox').textContent='';
$('#targetNumber').value=''; // নাম্বার বক্স ক্লিয়ার
notify($('#sendMsg'), '');
showTab('home');
// 'পাঠান' বাটন সচল করা হলো
const btn = $('#sendNowBtn');
if (btn) {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.orig || 'পাঠান';
}
});

// ক্যাশ ইন/আউট হিস্টরি থেকে ড্যাশবোর্ডে ফেরা
$('#backToDashboardCashIn')?.addEventListener('click', ()=>showTab('home'));
$('#backToDashboardCashOut')?.addEventListener('click', ()=>showTab('home'));

/*************************

Load Rates (NEW)
*************************/
async function loadRates() {
    try {
        const snap = await get(ref(db, 'rate'));
        if (snap.exists()) {
            RATES = snap.val() || { bdt: 0, perak_bdt: 0 };
        } else {
             RATES = { bdt: 0, perak_bdt: 0 };
        }
    } catch (e) {
        console.error("Error loading rates:", e);
        RATES = { bdt: 0, perak_bdt: 0 };
    }
    if (!mainAppEl.classList.contains('hidden')) {
        renderBranchRates();
    }
}

// রেন্ডার করার জন্য নতুন ফাংশন
function renderBranchRates(){
    const johorRate = Number(RATES.bdt) || 0;
    const perakRate = Number(RATES.perak_bdt) || 0;

    const jBtn = $('#branchJohor');
    const pBtn = $('#branchPerak');

    if (!jBtn || !pBtn) return; // Skip if send section is not yet rendered or visible

    jBtn.textContent = `Johor- ${johorRate.toFixed(2)}৳`;
    jBtn.dataset.rate = johorRate;
    
    pBtn.textContent = `Perak- ${perakRate.toFixed(2)}৳`;
    pBtn.dataset.rate = perakRate;

    // নিশ্চিত করা যে বর্তমানে সিলেক্ট করা রেটটি UI তে প্রতিফলিত হচ্ছে
    // যদি ডিফল্ট রেট (bdt) সেট করা না থাকে, তবে প্রথম পাওয়া রেটটি সিলেক্ট করা
    if(johorRate > 0 && perakRate === 0) SELECTED_RATE_KEY = 'bdt';
    else if(johorRate === 0 && perakRate > 0) SELECTED_RATE_KEY = 'perak_bdt';
    else if(johorRate > 0 && perakRate > 0 && !['bdt', 'perak_bdt'].includes(SELECTED_RATE_KEY)) SELECTED_RATE_KEY = 'bdt';


    if (SELECTED_RATE_KEY === 'bdt') {
        jBtn.classList.add('primary');
        jBtn.classList.remove('ghost');
        pBtn.classList.add('ghost');
        pBtn.classList.remove('primary');
    } else {
        pBtn.classList.add('primary');
        pBtn.classList.remove('ghost');
        jBtn.classList.add('ghost');
        jBtn.classList.remove('primary');
    }
    
    updateServiceAndTotals();
}

// ব্রাঞ্চ নির্বাচন হ্যান্ডলার
function handleBranchSelection(e) {
    const target = e.target.closest('.branch-rate-btn');
    if (!target) return;

    const key = target.dataset.branch;
    if (key !== SELECTED_RATE_KEY) {
        // সব বাটন থেকে active ক্লাস সরিয়ে নতুন বাটনে যোগ করা হলো
        document.querySelectorAll('.branch-rate-btn').forEach(btn => {
            btn.classList.remove('primary');
            btn.classList.add('ghost');
        });
        target.classList.add('primary');
        target.classList.remove('ghost');
        
        SELECTED_RATE_KEY = key;
        updateServiceAndTotals(); // ডিসপ্লে আপডেট করার জন্য
    }
}
$('#branchSelection')?.addEventListener('click', handleBranchSelection);


// সার্ভিস নির্বাচন হ্যান্ডলার
function handleServiceSelection(e) {
    if (e.target.type !== 'radio' || e.target.name !== 'sendService') return;
    
    SELECTED_SERVICE = e.target.value;
    $('#targetNumberLabel').textContent = `${SELECTED_SERVICE} নাম্বার দিন`;
    buildDisplay();
}
$('#serviceSelection')?.addEventListener('change', handleServiceSelection);

/*************************

Load Accounts & Balances
*************************/
async function loadAccounts(){
const snap = await get(ref(db, 'Account'));
if (!snap.exists()) {
ACCOUNTS = {}; ACCOUNT_LIST = []; renderAccounts(); updateTotalsOnHome();
return;
}
const data = snap.val() || {};
ACCOUNTS = data;
ACCOUNT_LIST = Object.keys(data).sort();
renderAccounts();
updateTotalsOnHome();

// NEW: Load Rates at startup (already loaded in initApp but called here for completeness)
await loadRates(); 
}

function renderAccounts(){
const listEl = $('#accountsList');
if (!listEl) return;
listEl.innerHTML = '';
let total = 0;
ACCOUNT_LIST.forEach(acc=>{
const bal = Number(ACCOUNTS?.[acc]?.Balance || 0);
total += bal;
const row = document.createElement('div');
row.className = 'item';
row.innerHTML = `<div> <div class="muted">একাউন্ট নাম্বার</div> <strong class="mono">${acc}</strong> </div> <div style="text-align:right"> <div class="muted">ব্যালেন্স</div> <strong class="mono">${formatCurrency(bal)}</strong> </div>`;
listEl.appendChild(row);
});
$('#accountCount').textContent = `${ACCOUNT_LIST.length} একাউন্ট`;
$('#totalBalance').textContent = formatCurrency(total);
}

function updateTotalsOnHome(){
let total = 0;
ACCOUNT_LIST.forEach(a=> total += Number(ACCOUNTS?.[a]?.Balance || 0));
$('#totalBalance').textContent = formatCurrency(total);
}

/*************************

DASHBOARD LOGIC (NEW)
*************************/

// ডেটা লোড: single_transaction, cash, cashout
async function loadDashboardData(){
    // 1. Load single_transaction
    const singleTxnSnap = await get(ref(db, 'single_transaction'));
    ALL_SINGLE_TXNS = [];
    if (singleTxnSnap.exists()){
        const t = singleTxnSnap.val() || {};
        Object.keys(t).forEach(key=>{
            const v = t[key];
            const dateEpoch = Number(v.timestamp || ddmmyyyyToEpoch(v.date)) || 0;
            if (dateEpoch) ALL_SINGLE_TXNS.push({ amount: Number(v.total_deducted || (Number(v.amount||0)+Number(v.charge||0))), date: v.date, timestamp: dateEpoch });
        });
    }
    // Sort reverse (latest first)
    ALL_SINGLE_TXNS.sort((a,b)=> (b.timestamp)-(a.timestamp));
    
    // 2. Load cash
    const cashInSnap = await get(ref(db, 'cash'));
    ALL_CASH_IN = [];
    if (cashInSnap.exists()){
        const t = cashInSnap.val() || {};
        Object.keys(t).forEach(key=>{
            const v = t[key];
            const dateEpoch = ddmmyyyyToEpoch(v.date) || 0;
            if (dateEpoch) ALL_CASH_IN.push({ amount: Number(v.amount || 0), date: v.date, timestamp: dateEpoch, note: v.note || '' });
        });
    }
    ALL_CASH_IN.sort((a,b)=> (b.timestamp)-(a.timestamp));
    
    // 3. Load cashout
    const cashOutSnap = await get(ref(db, 'cashout'));
    ALL_CASH_OUT = [];
    if (cashOutSnap.exists()){
        const t = cashOutSnap.val() || {};
        Object.keys(t).forEach(key=>{
            const v = t[key];
            const dateEpoch = ddmmyyyyToEpoch(v.date) || 0;
            if (dateEpoch) ALL_CASH_OUT.push({ amount: Number(v.amount || 0), date: v.date, timestamp: dateEpoch, note: v.note || '' });
        });
    }
    ALL_CASH_OUT.sort((a,b)=> (b.timestamp)-(a.timestamp));
    
    updateDashboardDisplay();
}

// ড্যাশবোর্ড ডিসপ্লে আপডেট
function updateDashboardDisplay(){
    
    if(!$('#section-dashboard')) return; // Skip if not on home tab

    const today = new Date();
    // আজকের তারিখ
    const todayDmy = epochToDmy(today.getTime());
    const todayStartEpoch = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    
    // গতকালের তারিখ
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayDmy = epochToDmy(yesterday.getTime());
    const yesterdayStartEpoch = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).getTime();
    
    // ১৫ দিন আগের তারিখ
    const fifteenDaysAgo = new Date(today);
    fifteenDaysAgo.setDate(today.getDate() - 14);
    const last15StartEpoch = new Date(fifteenDaysAgo.getFullYear(), fifteenDaysAgo.getMonth(), fifteenDaysAgo.getDate()).getTime();
    const last15StartDmy = epochToDmy(fifteenDaysAgo.getTime());


    // মাসিক শুরুর তারিখ (আগের মাসের ৩০ তারিখ বা এই মাসের ৩০ তারিখ)
    const monthlyDates = getAutoFilterDates();
    const monthlyStartEpoch = monthlyDates.startEpoch;
    const monthlyStartDmy = monthlyDates.startDmy;
    const monthlyEndDmy = monthlyDates.endDmy; // বর্তমান তারিখ

    // 1. লেনদেন ফিল্টারিং
    let todayTxns = { count: 0, amount: 0 };
    let yesterdayTxns = { count: 0, amount: 0 };
    let last15Txns = { count: 0, amount: 0 };
    let monthlyTxns = { count: 0, amount: 0 };
    
    for (const txn of ALL_SINGLE_TXNS){
        // ট্রানজেকশনের তারিখের শুধু দিন অংশ
        const txnDayEpoch = new Date(new Date(txn.timestamp).getFullYear(), new Date(txn.timestamp).getMonth(), new Date(txn.timestamp).getDate()).getTime();

        // আজকের লেনদেন
        if (txnDayEpoch >= todayStartEpoch) {
            todayTxns.count++; todayTxns.amount += txn.amount;
        }
        // গতকালের লেনদেন
        if (txnDayEpoch >= yesterdayStartEpoch && txnDayEpoch < todayStartEpoch) {
            yesterdayTxns.count++; yesterdayTxns.amount += txn.amount;
        }
        // গত ১৫ দিনের লেনদেন (আজ থেকে ১৫ দিন আগে পর্যন্ত)
        if (txnDayEpoch >= last15StartEpoch) {
            last15Txns.count++; last15Txns.amount += txn.amount;
        }
        // মাসিক লেনদেন (৩০ তারিখ থেকে)
        if (txnDayEpoch >= monthlyStartEpoch) {
            monthlyTxns.count++; monthlyTxns.amount += txn.amount;
        }
    }
    
    // 2. ক্যাশ ইন/আউট ফিল্টারিং
    let monthlyCashIn = 0;
    let monthlyCashOut = 0;
    
    for (const cash of ALL_CASH_IN){
        if (cash.timestamp >= monthlyStartEpoch) monthlyCashIn += cash.amount;
    }
    
    for (const cash of ALL_CASH_OUT){
        if (cash.timestamp >= monthlyStartEpoch) monthlyCashOut += cash.amount;
    }

    // 3. ড্যাশবোর্ড স্টেটে ডেটা সংরক্ষণ
    DASHBOARD_STATE = {
        todayTxnCount: todayTxns.count, todayTxnAmount: todayTxns.amount,
        yesterdayTxnCount: yesterdayTxns.count, yesterdayTxnAmount: yesterdayTxns.amount,
        last15TxnCount: last15Txns.count, last15TxnAmount: last15Txns.amount,
        monthlyTxnCount: monthlyTxns.count, monthlyTxnAmount: monthlyTxns.amount,
        monthlyCashIn: monthlyCashIn,
        monthlyCashOut: monthlyCashOut,
        monthlyStartDmy: monthlyStartDmy, monthlyEndDmy: monthlyEndDmy,
        last15StartDmy: last15StartDmy, last15EndDmy: todayDmy 
    };

    // 4. UI রেন্ডারিং
    
    // লেনদেন
    
    $('#today-txns-count').textContent = `${DASHBOARD_STATE.todayTxnCount} টি | তারিখ:${todayDmy}`;
    $('#today-txns-amount').textContent = formatCurrency(DASHBOARD_STATE.todayTxnAmount);
 
    $('#yesterday-txns-count').textContent = `${DASHBOARD_STATE.yesterdayTxnCount} টি | তারিখ: ${yesterdayDmy}`;
    $('#yesterday-date').textContent = yesterdayDmy;
    $('#yesterday-txns-amount').textContent = formatCurrency(DASHBOARD_STATE.yesterdayTxnAmount);

    $('#last15-txns-count').textContent = `${DASHBOARD_STATE.last15TxnCount} টি | ${DASHBOARD_STATE.last15StartDmy} - ${DASHBOARD_STATE.last15EndDmy}`;
    $('#last15-date-range').textContent = `${DASHBOARD_STATE.last15StartDmy} - ${DASHBOARD_STATE.last15EndDmy}`;
   $('#last15-txns-amount').textContent = formatCurrency(DASHBOARD_STATE.last15TxnAmount);

   $('#monthly-txns-count').textContent = `${DASHBOARD_STATE.monthlyTxnCount} টি | ${DASHBOARD_STATE.monthlyStartDmy} - ${DASHBOARD_STATE.monthlyEndDmy}`;
   $('#monthly-date-range').textContent = `${DASHBOARD_STATE.monthlyStartDmy} - ${DASHBOARD_STATE.monthlyEndDmy}`;
   $('#monthly-txns-amount').textContent = formatCurrency(DASHBOARD_STATE.monthlyTxnAmount);


    // ক্যাশ ইন/আউট
    $('#cashin-date-range').textContent = `${DASHBOARD_STATE.monthlyStartDmy} - ${DASHBOARD_STATE.monthlyEndDmy}`;
    $('#cashin-amount').textContent = formatCurrency(DASHBOARD_STATE.monthlyCashIn);
    
    $('#cashout-date-range').textContent = `${DASHBOARD_STATE.monthlyStartDmy} - ${DASHBOARD_STATE.monthlyEndDmy}`;
    $('#cashout-amount').textContent = formatCurrency(DASHBOARD_STATE.monthlyCashOut);
    
    // ফাইনাল হিসেব
    const finalResult = DASHBOARD_STATE.monthlyCashIn - DASHBOARD_STATE.monthlyTxnAmount - DASHBOARD_STATE.monthlyCashOut;
    $('#final-account-result').textContent = formatCurrency(finalResult);
    $('#final-account-breakdown').textContent = `${formatCurrency(DASHBOARD_STATE.monthlyCashIn)} (যোগ) - ${formatCurrency(DASHBOARD_STATE.monthlyTxnAmount)} (লেনদেন) - ${formatCurrency(DASHBOARD_STATE.monthlyCashOut)} (খরচ)`;
    
    // ক্যাশ ইন/আউট হিস্টরি রেন্ডার
    renderCashHistory('cash', ALL_CASH_IN.filter(c => c.timestamp >= monthlyStartEpoch));
    renderCashHistory('cashout', ALL_CASH_OUT.filter(c => c.timestamp >= monthlyStartEpoch));
}

// ⭐ ক্যাশ ইন/আউট হিস্টরি রেন্ডারিং
function renderCashHistory(type, rows) {
    const tbody = $(`#${type === 'cash' ? 'cashInTable' : 'cashOutTable'} tbody`);
    if (!tbody) return;
    tbody.innerHTML = '';
    rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.date}</td> <td class="mono">${formatCurrency(r.amount)}</td> <td>${r.note}</td>`;
        tbody.appendChild(tr);
    });
}

// ⭐ ক্যাশ ইন/আউট ডিসপ্লে ক্লিক হ্যান্ডলার
$('#cashin-amount-container')?.addEventListener('click', ()=>{
    renderCashHistory('cash', ALL_CASH_IN); // সব ডেটা দেখাবে
    showTab('cashin');
});
$('#cashout-amount-container')?.addEventListener('click', ()=>{
    renderCashHistory('cashout', ALL_CASH_OUT); // সব ডেটা দেখাবে
    showTab('cashout');
});

// ⭐ ক্যাশ ইন মডাল লজিক
$('#addCashInBtn')?.addEventListener('click', ()=>{
    $('#cashInModal').classList.remove('hidden');
    $('#cashInDate').value = todayStr();
    $('#cashInAmount').value = '';
    $('#cashInNote').value = '';
    notify($('#cashInMsg'), '');
});
$('#closeCashInModal')?.addEventListener('click', ()=> $('#cashInModal').classList.add('hidden'));

$('#saveCashInBtn')?.addEventListener('click', async ()=>{
    const amount = Number($('#cashInAmount').value || 0);
    const date = $('#cashInDate').value?.trim();
    const note = $('#cashInNote').value?.trim() || 'কোন নোট নেই';

    if (amount <= 0) { notify($('#cashInMsg'), 'সঠিক এমাউন্ট দিন', 'error'); return; }
    if (!date || !date.match(/^\d{2}\/\d{2}\/\d{4}$/)) { notify($('#cashInMsg'), 'সঠিক তারিখ দিন (DD/MM/YYYY)', 'error'); return; }

    try {
        const cashInRef = push(ref(db, 'cash'));
        await set(cashInRef, {
            amount: amount,
            date: date,
            note: note
        });
        
        notify($('#cashInMsg'), '✅ সফলভাবে ক্যাশ যোগ হয়েছে', 'success');
        $('#cashInModal').classList.add('hidden');
        loadDashboardData(); // ড্যাশবোর্ড রিলোড
        
    } catch(e){
        console.error(e);
        notify($('#cashInMsg'), '❌ সমস্যা হয়েছে। পরে আবার চেষ্টা করুন', 'error');
    }
});

// ⭐ ক্যাশ আউট মডাল লজিক
$('#addCashOutBtn')?.addEventListener('click', ()=>{
    $('#cashOutModal').classList.remove('hidden');
    $('#cashOutDate').value = todayStr();
    $('#cashOutAmount').value = '';
    $('#cashOutNote').value = '';
    notify($('#cashOutMsg'), '');
});
$('#closeCashOutModal')?.addEventListener('click', ()=> $('#cashOutModal').classList.add('hidden'));

$('#saveCashOutBtn')?.addEventListener('click', async ()=>{
    const amount = Number($('#cashOutAmount').value || 0);
    const date = $('#cashOutDate').value?.trim();
    const note = $('#cashOutNote').value?.trim() || 'কোন নোট নেই';

    if (amount <= 0) { notify($('#cashOutMsg'), 'সঠিক এমাউন্ট দিন', 'error'); return; }
    if (!date || !date.match(/^\d{2}\/\d{2}\/\d{4}$/)) { notify($('#cashOutMsg'), 'সঠিক তারিখ দিন (DD/MM/YYYY)', 'error'); return; }

    try {
        const cashOutRef = push(ref(db, 'cashout'));
        await set(cashOutRef, {
            amount: amount,
            date: date,
            note: note
        });
        
        notify($('#cashOutMsg'), '✅ সফলভাবে খরচ যোগ হয়েছে', 'success');
        $('#cashOutModal').classList.add('hidden');
        loadDashboardData(); // ড্যাশবোর্ড রিলোড
        
    } catch(e){
        console.error(e);
        notify($('#cashOutMsg'), '❌ সমস্যা হয়েছে। পরে আবার চেষ্টা করুন', 'error');
    }
});

/*************************

SEND MONEY: dynamic rows
*************************/
const sendRowsEl = $('#sendRows');

function rebuildSendRowsIfEmpty(){
if (sendRowsEl && sendRowsEl.children.length===0) addSendRow();
buildDisplay();
}

function addSendRow(pref={}){
const rowId = 'r'+Math.random().toString(36).slice(2,9);
const wrap = document.createElement('div');
wrap.className = 'item2';
wrap.dataset.id = rowId;
const options = ACCOUNT_LIST.map(a=>`<option value="${a}">${a}</option>`).join('');
wrap.innerHTML = `<div style="flex:1; min-width:200px;"> <label>একাউন্ট</label> <select class="sr-account"> <option value="">একটি নির্বাচন করুন</option> ${options} </select> <div class="muted" style="margin-top:6px;margin-bottom:10px">Available: <span class="sr-avl mono">0</span></div> <div class="err sr-err"></div> </div> <div style="width:160px"> <label>এমাউন্ট</label> <input class="sr-amt" type="tel" inputmode="numeric" pattern="[0-9]*" placeholder="0" /> </div> <div class="row" style="gap:6px"> <button class="btn ghost sr-del">মুছুন</button> </div>`;

if (pref.account) wrap.querySelector('.sr-account').value = pref.account;
if (pref.amount) wrap.querySelector('.sr-amt').value = pref.amount;

wrap.querySelector('.sr-account').addEventListener('change', () => {
updateRowAvailable(wrap);
updateServiceAndTotals();
buildDisplay();
});
wrap.querySelector('.sr-amt').addEventListener('input', () => {
validateRow(wrap);
updateServiceAndTotals();
buildDisplay();
});
wrap.querySelector('.sr-del').addEventListener('click', () => {
wrap.remove();
updateServiceAndTotals();
buildDisplay();
});

sendRowsEl?.appendChild(wrap);
updateRowAvailable(wrap);
updateServiceAndTotals();
buildDisplay();
}

function updateRowAvailable(row){
const acc = row.querySelector('.sr-account').value;
const avlEl = row.querySelector('.sr-avl');
const bal = Number(ACCOUNTS?.[acc]?.Balance || 0);
avlEl.textContent = formatCurrency(bal);
validateRow(row);
}

function validateRow(row){
const acc = row.querySelector('.sr-account').value;
const amt = Number(row.querySelector('.sr-amt').value || 0);
const errEl = row.querySelector('.sr-err');
errEl.textContent = '';
if (!acc) { errEl.textContent = 'একাউন্ট নির্বাচন করুন'; return false; }
const bal = Number(ACCOUNTS?.[acc]?.Balance || 0);
if (amt <= 0) { errEl.textContent = 'সঠিক এমাউন্ট লিখুন'; return false; }
if (amt > bal) { errEl.textContent = 'এই একাউন্টে পর্যাপ্ত ব্যালেন্স নেই'; return false; }
return true;
}

function getValidSendRows(){
const rows = Array.from(sendRowsEl?.children || []);
const valid = [];
for (const r of rows){
const acc = r.querySelector('.sr-account').value;
const amt = Number(r.querySelector('.sr-amt').value || 0);
if (!acc || !amt) continue;
valid.push({account: acc, amount: amt});
}
return valid;
}

// পরিবর্তিত: সার্ভিস চার্জ ইনপুট ফিল্ড থেকে মান নেবে
function updateServiceAndTotals(){
    const rows = getValidSendRows();
    const serviceChargeEl = $('#serviceCharge');
    const totalAmountEl = $('#totalAmount');
    if (!serviceChargeEl || !totalAmountEl) return;
    
    // সার্ভিস চার্জ ইনপুট ফিল্ড থেকে মান নেওয়া হচ্ছে
    const manualCharge = Number(serviceChargeEl.value) || 0;
    
    // মোট এমাউন্ট (চার্জ ছাড়া)
    const totalAmount = rows.reduce((s,r)=>s+Number(r.amount||0), 0);
    
    serviceChargeEl.value = manualCharge;
    totalAmountEl.value = totalAmount;

    // টোটাল অ্যামাউন্ট বা চার্জ পরিবর্তন হলে ডিসপ্লে আপডেট করা
    buildDisplay(); 
}

// পরিবর্তিত: SELECTED_SERVICE ব্যবহার করা হয়েছে
function buildDisplay(){
    const target = $('#targetNumber')?.value?.trim();
    const rows = getValidSendRows();
    const total = rows.reduce((s,r)=>s+Number(r.amount||0), 0);
    let lines = [];
    
    // পরিবর্তিত: সার্ভিস অনুযায়ী টেক্সট
    if (target) lines.push(`${SELECTED_SERVICE} ${target}`);
    
    lines.push(`টাকা ${total}`);
    rows.forEach(r=>{
    lines.push(`Pin ${r.account} টাকা ${r.amount}`);
    });
    const displayBox = $('#displayBox');
    if (displayBox) {
        displayBox.textContent = lines.join('\n');
    }
}

$('#addRowBtn')?.addEventListener('click', ()=> addSendRow());
$('#targetNumber')?.addEventListener('input', buildDisplay);
// নতুন ইভেন্ট লিসেনার: সার্ভিস চার্জ পরিবর্তন হলে টোটাল আপডেট করা
$('#serviceCharge')?.addEventListener('input', updateServiceAndTotals); 

$('#copyDisplayBtn')?.addEventListener('click', async ()=>{
try { 
    await navigator.clipboard.writeText($('#displayBox').textContent || '');
    notify($('#sendMsg'), 'কপি হয়েছে ✅', 'success');
} catch(e){ 
    // Show permission error message as requested
    alert('❌ কপি করা যায়নি। ব্রাউজারে বা ডিভাইসে Clipboard API ব্যবহারের অনুমতি দিন অথবা আপনার ব্রাউজার আপডেটেড কিনা নিশ্চিত করুন।');
    console.error("Copy failed: ", e);
    notify($('#sendMsg'), 'কপি করা যায়নি', 'error'); 
}
});

// NEW: RM Charge Calculation Function (UPDATED LOGIC)
function calculateRmCharges(rmAmountBase, branchKey) {
    // If Perak is selected (key is 'perak_bdt'), charge is always 5 RM.
    if (branchKey === 'perak_bdt') {
        return 5;
    }
    
    // Existing logic for Johor ('bdt')
    const amt = Math.ceil(rmAmountBase); // সিলিং করা হলো
    
    if (amt >= 701 && amt <= 5000) return 5;
    if (amt >= 401 && amt <= 700) return 4;
    if (amt >= 201 && amt <= 400) return 3;
    if (amt >= 1) return 2; // 1 to 200
    
    return 0;
}


// prevent multi-tap/double click on send
let isSending = false;
async function setSendLoading(active){
const btn = $('#sendNowBtn');
if (!btn) return;

if (active){
isSending = true;
btn.dataset.orig = btn.innerHTML;
btn.innerHTML = ' Processing...';
btn.disabled = true;
} else {
isSending = false;
// সফল বা ব্যর্থ যাই হোক, বাটন ডিসেবল থাকবে
btn.innerHTML = 'পাঠান';
btn.disabled = true; 
}
}

// SEND ACTION
$('#sendNowBtn')?.addEventListener('click', async ()=>{
if (isSending) return; // ignore multi-tap
notify($('#sendMsg'), '', '');
const target = $('#targetNumber')?.value?.trim();
const rows = getValidSendRows();
if (!target) { notify($('#sendMsg'), 'রিসিভার নাম্বার দিন', 'error'); return; }
if (rows.length===0) { notify($('#sendMsg'), 'কমপক্ষে একটি একাউন্ট ও এমাউন্ট দিন', 'error'); return; }

for (const r of rows){
const bal = Number(ACCOUNTS?.[r.account]?.Balance || 0);
if (r.amount <= 0 || r.amount > bal) {
notify($('#sendMsg'), `একাউন্ট ${r.account} এর ব্যালেন্স অপর্যাপ্ত`, 'error');
return;
}
}

await setSendLoading(true);
try {
const dateStr = todayStr();
const ts = Date.now();
// সার্ভিস চার্জ ইনপুট ফিল্ড থেকে নেওয়া হচ্ছে
const manualCharge = Number($('#serviceCharge')?.value) || 0; 
let totalCharge = manualCharge; // মোট চার্জ এখন ম্যানুয়াল চার্জের সমান
let totalAmount = 0; // মোট পাঠানো এমাউন্ট (চার্জ ছাড়া)
const displayText = $('#displayBox')?.textContent || '';

// 1. আগের মোট ব্যালেন্স সংরক্ষণ
const previousTotalBalance = getTotalBalance();
let totalDeductForAll = 0;
const selectedAccounts = []; // নির্বাচিত অ্যাকাউন্টগুলির তালিকা

// ডিডাকশন লজিক: চার্জ সব একাউন্টের মধ্যে সমানভাবে ভাগ করা হচ্ছে
const rowsCount = rows.length;
const chargePerAccount = rowsCount > 0 ? totalCharge / rowsCount : 0; 

for (let i = 0; i < rows.length; i++){
    const r = rows[i];
    
    // প্রতিটি একাউন্টের নিজস্ব চার্জ
    const currentCharge = chargePerAccount; 
    
    // মোট ডিডাকশন = পাঠানো এমাউন্ট + নিজস্ব চার্জ
    const totalDeduct = Number(r.amount) + currentCharge; 
    
    totalAmount += Number(r.amount);
    totalDeductForAll += totalDeduct;
    selectedAccounts.push(r.account); 

    const accRef = ref(db, `Account/${r.account}/Balance`);

    const prevBalSnap = await get(accRef);
    const previousBalance = Number(prevBalSnap.val() || 0);

    await runTransaction(accRef, (currentValue)=>{
        const cur = Number(currentValue||0);
        if (cur < totalDeduct) return cur; 
        return cur - totalDeduct;
    });

    const newBalSnap = await get(accRef); 
    const currentBalance = Number(newBalSnap.val()||0);

    ACCOUNTS[r.account] = { ...(ACCOUNTS[r.account]||{}), Balance: currentBalance }; 

    // 2. Account-specific transaction saving (NO CHANGE, as requested)
    const accountTxRef = push(ref(db, `Account/${r.account}/transaction`)); 
    await set(accountTxRef, { 
        number: target, 
        account_number: r.account, 
        amount: Number(r.amount), 
        charge: currentCharge, // প্রতিটি একাউন্টের চার্জ
        total_deducted: totalDeduct, 
        date: dateStr, 
        timestamp: ts,
        previous_balance: previousBalance, 
        current_balance: currentBalance 
    }); 
} 

await loadAccounts(); // নতুন ব্যালেন্স রিলোড করা হলো
const currentTotalBalance = getTotalBalance(); // নতুন মোট ব্যালেন্স 
const accountsString = selectedAccounts.join(','); // কমা দিয়ে অ্যাকাউন্টগুলি যুক্ত করা হলো

// 3. Single_transaction সেভিং (মোট ব্যালেন্সের হিসাব) - NO CHANGE, as requested
const singleTxRef = push(ref(db, 'single_transaction')); 
await set(singleTxRef, { 
    number: target, 
    account_number: accountsString, // কমা যুক্ত অ্যাকাউন্টগুলি সেভ করা হলো
    amount: totalAmount, // চার্জ ছাড়া মোট পাঠানো এমাউন্ট
    charge: totalCharge, // ম্যানুয়াল চার্জ
    total_deducted: totalDeductForAll, // মোট ডিডাকশন (এমাউন্ট + চার্জ)
    date: dateStr, 
    timestamp: ts,
    previous_balance: previousTotalBalance, // মোট আগের ব্যালেন্স
    current_balance: currentTotalBalance, // মোট নতুন ব্যালেন্স
    display_text: displayText,
}); 


// --- NEW: RM Calculation and All_Transaction Saving ---
const selectedBranchButton = $('#branchSelection')?.querySelector('.primary');
const selectedRate = Number(selectedBranchButton?.dataset?.rate) || 0;
const branchName = selectedBranchButton?.textContent.split('-')[0].trim();
const branchKey = selectedBranchButton?.dataset?.branch; // Get branch key

let chargerm = 0;
let totalrm = 0;
let rate = selectedRate;
let rmBase = 0;

if (rate > 0 && totalDeductForAll > 0) {
    rmBase = totalDeductForAll / rate;
    // Calculate chargerm using the updated logic
    chargerm = calculateRmCharges(rmBase, branchKey); 
    
    totalrm = rmBase + chargerm;
    totalrm = parseFloat(totalrm.toFixed(2)); // ২ দশমিক পর্যন্ত রাখলাম
    chargerm = parseFloat(chargerm.toFixed(2)); // ২ দশমিক পর্যন্ত রাখলাম
}

// 4. Save aggregate into all_transaction (with NEW fields)
let newDisplayText = displayText + '\n' + 
                     `রেট: ${rate.toFixed(2)} (ব্রাঞ্চ: ${branchName})` + '\n' +
                     `চার্য :${chargerm.toFixed(2)}` + '\n' +
                     `মোট RM: ${totalrm.toFixed(2)}`;

const allRef = push(ref(db, 'all_transaction')); 
await set(allRef, { 
    date: dateStr, 
    timestamp: ts,
    display_text: newDisplayText,
    number: target, 
    rate: rate,         
    chargerm: chargerm,         
    totalrm: totalrm,           
    total_deducted: totalDeductForAll, 
    branch: branchName, // <-- ADDED THIS LINE
}); 
// --- END NEW: RM Calculation and All_Transaction Saving ---


buildDisplay(); 
notify($('#sendMsg'), '✅ সফলভাবে পাঠানো হয়েছে ও ট্রানজেকশন সেভ হয়েছে', 'success'); 
loadDashboardData(); // ড্যাশবোর্ড আপডেট করা হলো

} catch (e){
console.error(e);
notify($('#sendMsg'), '❌ সমস্যা হয়েছে। পরে আবার চেষ্টা করুন', 'error');
} finally {
await setSendLoading(false);
}
});

/*************************

TRANSACTIONS VIEW (per-account)
*************************/
async function loadAllTransactions(){
const all = [];

// শুধুমাত্র 'single_transaction' থেকে ডেটা লোড করা হচ্ছে
const snap = await get(ref(db, 'single_transaction')); 
if (snap.exists()){
    const t = snap.val() || {};
    Object.keys(t).forEach(key=>{
        const v = t[key];
        
        // শুধুমাত্র অ্যাকাউন্ট নাম্বার বা স্ট্রিংটি ব্যবহার করা হচ্ছে।
        const accountDisplay = v.account_number;

        all.push({
            id: key,
            account: accountDisplay, 
            number: v.number || '',
            amount: Number(v.amount||0),
            charge: Number(v.charge||0),
            total: Number(v.total_deducted|| (Number(v.amount||0)+Number(v.charge||0))),
            date: v.date || (v.timestamp? epochToDmy(v.timestamp): ''),
            timestamp: Number(v.timestamp || ddmmyyyyToEpoch(v.date)) || 0,
            previous_balance: Number(v.previous_balance || 0), 
            current_balance: Number(v.current_balance || 0) 
        });
    });
}
    
// Sort reverse (latest first)
all.sort((a,b)=> (b.timestamp)-(a.timestamp));
window.ALL_TXNS = all;

const dates = getAutoFilterDates();
const dateFromEl = $('#dateFrom');
const dateToEl = $('#dateTo');

if (dateFromEl) dateFromEl.value = dates.fromYmd;
if (dateToEl) dateToEl.value = dates.toYmd;

applyFilters();
}

function renderTxnTable(rows){
const tbody = $('#txnTable tbody');
if (!tbody) return;

tbody.innerHTML = '';
rows.forEach(r=>{
const tr = document.createElement('tr');
tr.innerHTML = `<td>${r.date}</td> <td class="mono">${r.account}</td> <td class="mono">${r.number}</td> <td class="mono">${formatCurrency(r.amount)}</td> <td class="mono">${formatCurrency(r.charge)}</td> <td class="mono">${formatCurrency(r.total)}</td> <td class="mono">${formatCurrency(r.previous_balance)}</td> <td class="mono">${formatCurrency(r.current_balance)}</td>`;
tbody.appendChild(tr);
});
$('#txnCount').textContent = rows.length;
// ⭐ পরিবর্তিত: মোট এমাউন্ট হিসেবে 'মোট কাটা' (total) ব্যবহার করা হচ্ছে
const sumTotalDeducted = rows.reduce((s,x)=>s+x.total,0);
const sumChg = rows.reduce((s,x)=>s+x.charge,0);
$('#summary').textContent = `মোট: ${rows.length} টি | টাকা: ${formatCurrency(sumTotalDeducted)} | চার্জ: ${formatCurrency(sumChg)}`;
}

function applyFilters(){
const q = ($('#searchBox')?.value||'').toLowerCase();
const f = ymdToEpoch($('#dateFrom')?.value);
const t = ymdToEpoch($('#dateTo')?.value);
let rows = (window.ALL_TXNS||[]).slice();

if (f) rows = rows.filter(x=> x.timestamp >= f);
if (t) rows = rows.filter(x=> x.timestamp <= (t + (24*60*60*1000) - 1)); 
if (q) rows = rows.filter(x=> `${x.account}`.toLowerCase().includes(q)
|| `${x.number}`.toLowerCase().includes(q)
|| String(x.amount).includes(q)
|| String(x.charge).includes(q)
);
renderTxnTable(rows);
}

$('#applyFilterBtn')?.addEventListener('click', applyFilters);
$('#searchBox')?.addEventListener('input', applyFilters);

/*************************

ALL_TRANSACTIONS (aggregate) view
*************************/
async function loadAllAggregateTransactions(){
const snap = await get(ref(db, 'all_transaction'));
const all = [];
if (snap.exists()){
const data = snap.val() || {};
Object.keys(data).forEach(k=>{
const v = data[k];
all.push({
id: k,
display_text: v.display_text || '', 
date: v.date || (v.timestamp? epochToDmy(v.timestamp): ''),
timestamp: Number(v.timestamp || ddmmyyyyToEpoch(v.date)) || 0,
// NEW/Updated fields:
number: v.number || '', 
total_deducted: Number(v.total_deducted || 0), 
rate: Number(v.rate || 0), 
chargerm: Number(v.chargerm || 0), 
totalrm: Number(v.totalrm || 0),
branch: v.branch || '' // <-- ADDED THIS LINE
});
});
}
// reverse sort (latest first)
all.sort((a,b)=> (b.timestamp)-(a.timestamp));
window.ALL_AGG = all;

const dates = getAutoFilterDates();
const allDateFromEl = $('#allDateFrom');
const allDateToEl = $('#allDateTo');

if (allDateFromEl) allDateFromEl.value = dates.fromYmd;
if (allDateToEl) allDateToEl.value = dates.toYmd;

applyAllFilters();
}

// renderAllTxnTable
function renderAllTxnTable(rows){
const tbody = $('#allTxnTable tbody');
if (!tbody) return;

tbody.innerHTML = '';

let sumTotalDeductedAll = 0;
let sumChargeRmAll = 0;
let sumTotalRmAll = 0;

rows.forEach(r=>{
    // Sum calculations
    sumTotalDeductedAll += r.total_deducted;
    sumChargeRmAll += r.chargerm;
    sumTotalRmAll += r.totalrm;

    const tr = document.createElement('tr');
        
    // The display text cell (last column)
    const displayCell = document.createElement('td');
    displayCell.className = 'mono display-cell';
    displayCell.setAttribute('data-text', r.display_text.replace(/"/g, '&quot;')); 
    displayCell.style.cssText = 'display:flex; justify-content:space-between; align-items:flex-start; min-width: 250px;'; 

    displayCell.innerHTML = `
        <pre style="white-space:pre-wrap;margin:0; flex-grow:1;">${r.display_text}</pre>
        <button class="btn ghost copy-btn" style="padding: 2px 5px; margin-left: 5px; font-size: 14px; cursor: pointer; flex-shrink: 0;">📎</button>
    `;

    // New table row structure (ADDED BRANCH)
    tr.innerHTML = `
        <td>${r.date}</td>
        <td class="mono">${r.branch}</td> 
        <td class="mono">${r.number}</td>
        <td class="mono">${formatCurrency(r.total_deducted)}</td>
        <td class="mono">${r.rate.toFixed(2)}</td>
        <td class="mono">${r.chargerm.toFixed(2)}</td>
        <td class="mono">${r.totalrm.toFixed(2)}</td>
    `;
    tr.appendChild(displayCell); // Append the display cell (last column)
    tbody.appendChild(tr);

    // DOM এ যুক্ত হওয়ার পর ইভেন্ট লিসেনার যোগ করা হচ্ছে
    const copyButton = tr.querySelector('.copy-btn');
    copyButton?.addEventListener('click', async (e) => {
        const textToCopy = e.currentTarget.closest('.display-cell').getAttribute('data-text');

        try {
            e.stopPropagation(); 
            await navigator.clipboard.writeText(textToCopy || '');
            const btn = e.currentTarget;
            btn.textContent = '✅'; 
            setTimeout(() => { btn.textContent = '📎'; }, 1000); 
        } catch(err){
            // Changed alert to prompt for permission as requested
            alert('❌ কপি করা যায়নি। ব্রাউজারে বা ডিভাইসে Clipboard API ব্যবহারের অনুমতি দিন অথবা আপনার ব্রাউজার আপডেটেড কিনা নিশ্চিত করুন।');
            console.error("Copy failed: ", err); 
        }
    });
});

$('#allTxnCount').textContent = rows.length;
// ⭐ সংক্ষিপ্ত হিসাবে মোট BDT কাটা, চার্জ RM, ও টোটাল RM যোগ করা (UPDATED SUMMARY)
$('#allSummary').innerHTML = `
    মোট: ${rows.length} টি | 
    ডেডাকটেড BDT: ${formatCurrency(sumTotalDeductedAll)} | 
    চার্জ RM: ${sumChargeRmAll.toFixed(2)} | 
    মোট RM: ${sumTotalRmAll.toFixed(2)}
`;

}

function applyAllFilters(){
    const q = ($('#allSearchBox')?.value||'').toLowerCase();
    const f = ymdToEpoch($('#allDateFrom')?.value);
    const t = ymdToEpoch($('#allDateTo')?.value);
    const branch = $('#branchFilter')?.value; // <-- GET BRANCH FILTER VALUE
    let rows = (window.ALL_AGG||[]).slice();

    if (f) rows = rows.filter(x=> x.timestamp >= f);
    if (t) rows = rows.filter(x=> x.timestamp <= (t + (24*60*60*1000) - 1));
    if (branch) rows = rows.filter(x=> x.branch === branch); // <-- APPLY BRANCH FILTER
    if (q) rows = rows.filter(x=> 
        `${x.display_text}`.toLowerCase().includes(q) || 
        `${x.number}`.toLowerCase().includes(q) 
    );

    renderAllTxnTable(rows);
}

$('#applyAllFilterBtn')?.addEventListener('click', applyAllFilters);
$('#allSearchBox')?.addEventListener('input', applyAllFilters);
$('#branchFilter')?.addEventListener('change', applyAllFilters); // <-- ADDED EVENT LISTENER

/*************************

Settings (UNMODIFIED LOGIC)
*************************/
$('#btnSettings')?.addEventListener('click', ()=>{
$('#settingsPanel').classList.toggle('hidden');
});
$('#closeSettings')?.addEventListener('click', ()=> $('#settingsPanel').classList.add('hidden'));
$('#themeLight')?.addEventListener('click', ()=>{ document.body.classList.add('light'); $('#settingsPanel').classList.add('hidden'); });
$('#themeDefault')?.addEventListener('click', ()=>{ document.body.classList.remove('light'); $('#settingsPanel').classList.add('hidden'); });

/*************************

Init
*************************/
$('#addRowBtn')?.addEventListener('click', ()=>{}); // placeholder to keep order

async function initApp() {
    // 1. Initial setup and login check
    await loadRates();
    await checkAuthStatus();
    
    // 2. Event listeners for app content (only active when logged in)
    document.getElementById('addbalance')?.addEventListener('click', function () {
        window.location.href = 'wallet.html';
    });

    document.getElementById('sim')?.addEventListener('click', function () {
        window.location.href = 'sim.html';
    });

    // 3. Live Listeners
    const mainAppEl = $('#main-app');

    onValue(ref(db, 'cash'), (snapshot) => {
        if (snapshot.exists() && !mainAppEl.classList.contains('hidden')) {
            loadDashboardData();
        }
    });

    onValue(ref(db, 'cashout'), (snapshot) => {
        if (snapshot.exists() && !mainAppEl.classList.contains('hidden')) {
            loadDashboardData();
        }
    });

    onValue(ref(db, 'single_transaction'), (snapshot) => {
        if (snapshot.exists() && !mainAppEl.classList.contains('hidden')) {
            loadDashboardData();
        }
    });

    onValue(ref(db, 'rate'), (snapshot) => {
        loadRates();
    });
}

initApp();