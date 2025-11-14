/*************************

Firebase Initialization
*************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";
import {
getDatabase, ref, child, get, set, update, push, runTransaction
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
return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num)+' ৳';
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
    let start = new Date(today.getFullYear(), today.getMonth(), 30); 

    if (today.getDate() < 30) {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 30);
    }
    
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 29);

    const formatYmd = (d) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth()+1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${yyyy}-${mm}-${dd}`;
    };

    return {
        fromYmd: formatYmd(start),
        toYmd: formatYmd(end),
    };
};

/*************************

State
*************************/
let ACCOUNTS = {}; // {accountNo: { Balance: number, ... }}
let ACCOUNT_LIST = []; // [accountNo]

function getTotalBalance(){
    return ACCOUNT_LIST.reduce((s,a)=> s + Number(ACCOUNTS?.[a]?.Balance || 0), 0);
}

/*************************

UI: Tabs / Sections
*************************/
const sections = {
home: ['#section-profile', '#section-accounts'],
send: ['#section-send'],
txns: ['#section-transactions'],
alltxns: ['#section-alltransactions']
};

function hideAllSections(){
['#section-profile','#section-accounts','#section-send','#section-transactions','#section-alltransactions'].forEach(id=>{
const el = $(id); if(el) el.classList.add('hidden');
});
$$('.nav .nbtn').forEach(b=>b.classList.remove('active'));
}

function showTab(tab){
hideAllSections();
(sections[tab]||[]).forEach(id=>$(id).classList.remove('hidden'));
if (tab==='home') $('#navHome').classList.add('active');
if (tab==='send') $('#navSend').classList.add('active');
if (tab==='txns') loadAllTransactions(); 
if (tab==='txns') $('#navTxns').classList.add('active');
// special: when opening send or txns, ensure data up-to-date
if (tab==='send') rebuildSendRowsIfEmpty();
if (tab==='alltxns') loadAllAggregateTransactions();
}

$('#navHome').addEventListener('click', ()=>showTab('home'));
$('#navSend').addEventListener('click', ()=>showTab('send'));
$('#navTxns').addEventListener('click', ()=>showTab('txns'));

$('#btnAllTxns').addEventListener('click', ()=>{
showTab('alltxns');
});

// 'পেছনে যান' বাটনের কার্যকারিতা
$('#backHomeBtn').addEventListener('click', ()=>{
// সকল ইনপুট ও ডিসপ্লে ক্লিয়ার
$('#sendRows').innerHTML='';
updateServiceAndTotals();
$('#displayBox').textContent='';
$('#targetNumber').value=''; // নাম্বার বক্স ক্লিয়ার
notify($('#sendMsg'), '');
showTab('home');
// 'পাঠান' বাটন সচল করা হলো
const btn = $('#sendNowBtn');
btn.disabled = false;
btn.innerHTML = btn.dataset.orig || 'পাঠান';
});

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
}

function renderAccounts(){
const listEl = $('#accountsList');
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

SEND MONEY: dynamic rows
*************************/
const sendRowsEl = $('#sendRows');

function rebuildSendRowsIfEmpty(){
if (sendRowsEl.children.length===0) addSendRow();
buildDisplay();
}

function addSendRow(pref={}){
const rowId = 'r'+Math.random().toString(36).slice(2,9);
const wrap = document.createElement('div');
wrap.className = 'item2';
wrap.dataset.id = rowId;
const options = ACCOUNT_LIST.map(a=>`<option value="${a}">${a}</option>`).join('');
wrap.innerHTML = `<div style="flex:1; min-width:200px;"> <label>একাউন্ট</label> <select class="sr-account"> <option value="">একটি নির্বাচন করুন</option> ${options} </select> <div class="muted" style="margin-top:6px">Available: <span class="sr-avl mono">0</span></div> <div class="err sr-err"></div> </div> <div style="width:160px"> <label>এমাউন্ট</label> <input class="sr-amt" type="tel" inputmode="numeric" pattern="[0-9]*" placeholder="0" /> </div> <div class="row" style="gap:6px"> <button class="btn ghost sr-del">মুছুন</button> </div>`;

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

sendRowsEl.appendChild(wrap);
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
const rows = Array.from(sendRowsEl.children);
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
    // সার্ভিস চার্জ ইনপুট ফিল্ড থেকে মান নেওয়া হচ্ছে
    const manualCharge = Number($('#serviceCharge').value) || 0;
    
    // মোট এমাউন্ট (চার্জ ছাড়া)
    const totalAmount = rows.reduce((s,r)=>s+Number(r.amount||0), 0);
    
    $('#serviceCharge').value = manualCharge;
    $('#totalAmount').value = totalAmount;

    // টোটাল অ্যামাউন্ট বা চার্জ পরিবর্তন হলে ডিসপ্লে আপডেট করা
    buildDisplay(); 
}

function buildDisplay(){
const target = $('#targetNumber').value?.trim();
const rows = getValidSendRows();
const total = rows.reduce((s,r)=>s+Number(r.amount||0), 0);
let lines = [];
if (target) lines.push(`বিকাশ ${target}`);
lines.push(`টাকা ${total}`);
rows.forEach(r=>{
lines.push(`Pin ${r.account} টাকা ${r.amount}`);
});
$('#displayBox').textContent = lines.join('\n');
}

$('#addRowBtn').addEventListener('click', ()=> addSendRow());
$('#targetNumber').addEventListener('input', buildDisplay);
// নতুন ইভেন্ট লিসেনার: সার্ভিস চার্জ পরিবর্তন হলে টোটাল আপডেট করা
$('#serviceCharge').addEventListener('input', updateServiceAndTotals); 

$('#copyDisplayBtn').addEventListener('click', async ()=>{
try { await navigator.clipboard.writeText($('#displayBox').textContent || '');
notify($('#sendMsg'), 'কপি হয়েছে ✅', 'success');
} catch(e){ notify($('#sendMsg'), 'কপি করা যায়নি', 'error'); }
});

// prevent multi-tap/double click on send
let isSending = false;
async function setSendLoading(active){
const btn = $('#sendNowBtn');
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
$('#sendNowBtn').addEventListener('click', async ()=>{
if (isSending) return; // ignore multi-tap
notify($('#sendMsg'), '', '');
const target = $('#targetNumber').value?.trim();
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
const manualCharge = Number($('#serviceCharge').value) || 0; 
let totalCharge = manualCharge; // মোট চার্জ এখন ম্যানুয়াল চার্জের সমান
let totalAmount = 0; // মোট পাঠানো এমাউন্ট (চার্জ ছাড়া)
const displayText = $('#displayBox').textContent || '';

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

    // 2. Account-specific transaction saving
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

// 3. Single_transaction সেভিং (মোট ব্যালেন্সের হিসাব)
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


// 4. Save aggregate into all_transaction (for All Transactions Tab)
const allRef = push(ref(db, 'all_transaction')); 
await set(allRef, { 
    date: dateStr, 
    timestamp: ts,
    display_text: displayText,
}); 

buildDisplay(); 
notify($('#sendMsg'), '✅ সফলভাবে পাঠানো হয়েছে ও ট্রানজেকশন সেভ হয়েছে', 'success'); 

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
$('#dateFrom').value = dates.fromYmd;
$('#dateTo').value = dates.toYmd;
applyFilters();
}

function renderTxnTable(rows){
const tbody = $('#txnTable tbody');
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
const q = ($('#searchBox').value||'').toLowerCase();
const f = ymdToEpoch($('#dateFrom').value);
const t = ymdToEpoch($('#dateTo').value);
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

$('#applyFilterBtn').addEventListener('click', applyFilters);
$('#searchBox').addEventListener('input', applyFilters);

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
timestamp: Number(v.timestamp || ddmmyyyyToEpoch(v.date)) || 0
});
});
}
// reverse sort (latest first)
all.sort((a,b)=> (b.timestamp)-(a.timestamp));
window.ALL_AGG = all;

const dates = getAutoFilterDates();
$('#allDateFrom').value = dates.fromYmd;
$('#allDateTo').value = dates.toYmd;
applyAllFilters();
}

// renderAllTxnTable
function renderAllTxnTable(rows){
const tbody = $('#allTxnTable tbody');
tbody.innerHTML = '';
rows.forEach(r=>{
const tr = document.createElement('tr');
    
// ডিসপ্লে টেক্সট data-text অ্যাট্রিবিউটে সেভ করা হয়েছে
const displayCell = document.createElement('td');
displayCell.className = 'mono display-cell';
// এখানে ডিসপ্লে টেক্সট এ যদি কোটেশন মার্ক থাকে, তবে তা HTML অ্যাট্রিবিউটে ব্যবহার করার জন্য এনকোড করা হচ্ছে।
displayCell.setAttribute('data-text', r.display_text.replace(/"/g, '&quot;')); 
displayCell.style.cssText = 'display:flex; justify-content:space-between; align-items:flex-start;';

displayCell.innerHTML = `
    <pre style="white-space:pre-wrap;margin:0; flex-grow:1;">${r.display_text}</pre>
    <button class="btn ghost copy-btn" style="padding: 2px 5px; margin-left: 5px; font-size: 14px; cursor: pointer;">📎</button>
`;

tr.innerHTML = `<td>${r.date}</td>`;
tr.appendChild(displayCell);
tbody.appendChild(tr);

// DOM এ যুক্ত হওয়ার পর ইভেন্ট লিসেনার যোগ করা হচ্ছে
const copyButton = tr.querySelector('.copy-btn');
copyButton.addEventListener('click', async (e) => {
    // ডিসপ্লে টেক্সট data-text অ্যাট্রিবিউউট থেকে নেওয়া হচ্ছে
    const textToCopy = e.currentTarget.closest('.display-cell').getAttribute('data-text');

    try {
        e.stopPropagation(); 
        await navigator.clipboard.writeText(textToCopy || '');
        const btn = e.currentTarget;
        btn.textContent = '✅'; 
        setTimeout(() => { btn.textContent = '📎'; }, 1000); 
    } catch(err){
        // এরোর মেসেজ না দেখিয়ে শুধু সতর্কতা দেখাচ্ছি, যাতে ইউজার বিভ্রান্ত না হন
        alert('❌ কপি করা যায়নি। ব্রাউজারে Clipboard API ব্যবহারের অনুমতি দিন।');
        console.error("Copy failed: ", err); 
    }
});
});

$('#allTxnCount').textContent = rows.length;
// ⭐ সংক্ষিপ্ত হিসাবে মোট কাটা যোগ করা
const sumTotalDeductedAll = rows.reduce((s,x)=>s+x.total,0);
const sumChargeAll = rows.reduce((s,x)=>s+x.charge,0);
$('#allSummary').textContent = `মোট: ${rows.length} টি | টাকা: ${formatCurrency(sumTotalDeductedAll)} | চার্জ: ${formatCurrency(sumChargeAll)}`;

}

function applyAllFilters(){
const q = ($('#allSearchBox').value||'').toLowerCase();
const f = ymdToEpoch($('#allDateFrom').value);
const t = ymdToEpoch($('#allDateTo').value);
let rows = (window.ALL_AGG||[]).slice();

if (f) rows = rows.filter(x=> x.timestamp >= f);
if (t) rows = rows.filter(x=> x.timestamp <= (t + (24*60*60*1000) - 1));
if (q) rows = rows.filter(x=> `${x.display_text}`.toLowerCase().includes(q) );

renderAllTxnTable(rows);
}

$('#applyAllFilterBtn').addEventListener('click', applyAllFilters);
$('#allSearchBox').addEventListener('input', applyAllFilters);

/*************************

Settings
*************************/
$('#btnSettings').addEventListener('click', ()=>{
$('#settingsPanel').classList.toggle('hidden');
});
$('#closeSettings').addEventListener('click', ()=> $('#settingsPanel').classList.add('hidden'));
$('#themeLight').addEventListener('click', ()=>{ document.body.classList.add('light'); $('#settingsPanel').classList.add('hidden'); });
$('#themeDefault').addEventListener('click', ()=>{ document.body.classList.remove('light'); $('#settingsPanel').classList.add('hidden'); });

/*************************

Init
*************************/
$('#addRowBtn').addEventListener('click', ()=>{}); // placeholder to keep order

await loadAccounts();
showTab('home');

document.getElementById("help").addEventListener("click", function() {
// + না দিয়ে দেশ কোড সহ নম্বর দিন
window.location.href = "https://wa.me/8801799563159";
// চাইলে মেসেজও যোগ করতে পারেন:
// window.location.href = "https://wa.me/8801799563159?text=" + encodeURIComponent("হ্যালো, হেল্প লাগবে");
});

document.getElementById('addbalance').addEventListener('click', function () {
window.location.href = 'wallet.html';
});

document.getElementById('sim').addEventListener('click', function () {
window.location.href = 'sim.html';
});
