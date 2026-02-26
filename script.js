// Firebase SDKs Import
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// 1. Firebase Configuration (Apnar deya config)
const firebaseConfig = {
    apiKey: "AIzaSyD7GsUQ9ez0xbDyQiQEp9xk9OPXCLXjgE8",
    authDomain: "varsity-room-tracker.firebaseapp.com",
    databaseURL: "https://varsity-room-tracker-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "varsity-room-tracker",
    storageBucket: "varsity-room-tracker.firebasestorage.app",
    messagingSenderId: "218185535738",
    appId: "1:218185535738:web:165a8a110842e3dd953943"
};

// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const periods = ["08:00 AM-08:50 AM", "08:50 AM-09:40 AM", "09:40 AM-10:30 AM", "10:30 AM-11:20 AM", "11:20 AM-12:10 PM", "12:10 PM-01:00 PM", "01:00 PM-01:50 PM", "01:50 PM-02:40 PM", "02:40 PM-03:30 PM", "03:30 PM-04:20 PM", "04:20 PM-05:10 PM", "05:10 PM-06:00 PM"];
const mentorCodes = ["RATUL2026"];
let isMentor = false, roomData = [], liveBookings = [], currentRoom = null;

// UI Setup & CSV Loading
function init() {
    const grid = document.getElementById('periodGrid');
    if(grid) {
        grid.innerHTML = "";
        periods.forEach(p => {
            grid.innerHTML += `<label class="bg-slate-50 p-2 rounded-lg flex items-center gap-2 cursor-pointer border border-transparent hover:border-indigo-200 transition text-[9px]"><input type="checkbox" value="${p}" class="p-check"> ${p}</label>`;
        });
    }
    loadCSV();
    syncWithFirebase(); // Firebase theke data ana
}

async function loadCSV() {
    try {
        const res = await fetch('routine.csv');
        const text = await res.text();
        const rows = text.split('\n').filter(r => r.trim() !== "");
        roomData = rows.slice(1).map(row => {
            const parts = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            return { day: parts[0].trim(), room: parts[1].replace(/"/g, "").trim(), slots: parts[2].replace(/"/g, "").split(',').map(s => s.trim()) };
        });
    } catch (e) { console.error("CSV loading error"); }
}

// 3. Real-time Sync with Firebase
function syncWithFirebase() {
    const bookingsRef = ref(db, 'bookings');
    onValue(bookingsRef, (snapshot) => {
        const data = snapshot.val();
        liveBookings = data ? Object.values(data) : [];
        updateLiveUI();
        refreshMentorPanel();
        searchRooms(); // Room status live update kora
    });
}

// Mentor Login/Logout
window.loginMentor = function() {
    if (mentorCodes.includes(document.getElementById('mCodeInput').value)) {
        isMentor = true;
        document.getElementById('authArea').innerHTML = `<span class="text-indigo-900 font-bold text-[10px] bg-white px-2 py-1 rounded shadow">Mentor Active</span>`;
        document.getElementById('mentorDashboard').classList.remove('hidden');
        closeModal('mentorModal');
        refreshMentorPanel();
        searchRooms();
    } else { alert("Invalid Code!"); }
};

window.logout = function() {
    isMentor = false;
    document.getElementById('authArea').innerHTML = `<button onclick="openModal('mentorModal')" class="bg-white text-indigo-900 px-3 py-2 rounded-lg text-xs font-bold shadow">MENTOR LOGIN</button>`;
    document.getElementById('mentorDashboard').classList.add('hidden');
    searchRooms();
};

function refreshMentorPanel() {
    const list = document.getElementById('myBookingsList');
    if(!list) return;
    list.innerHTML = liveBookings.length > 0 ? "" : `<p class="text-xs text-slate-400 italic text-center py-4">No active bookings.</p>`;
    liveBookings.forEach((b) => {
        list.innerHTML += `
            <div class="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm border border-indigo-100">
                <div class="text-xs"><b>${b.room}</b> (${b.wing})<br><span class="text-slate-400">${b.slot}</span></div>
                <button onclick="cancelBooking('${b.id}')" class="bg-red-600 text-white px-3 py-2 rounded-lg text-[10px] font-bold">CANCEL BOOKING</button>
            </div>`;
    });
}

window.cancelBooking = function(bookingId) {
    remove(ref(db, 'bookings/' + bookingId)).then(() => {
        alert("Booking Cancelled!");
        logout(); // Automatic Logout on cancel
    });
};

// Search & Booking Logic
window.searchRooms = function() {
    const day = document.getElementById('daySelect').value;
    const selectedTimes = Array.from(document.querySelectorAll('.p-check:checked')).map(c => c.value);
    const resultsDiv = document.getElementById('roomResults');
    if(!resultsDiv) return;
    resultsDiv.innerHTML = "";

    if (selectedTimes.length === 0) return;

    const available = roomData.map(r => {
        if (r.day.toLowerCase() !== day.toLowerCase()) return null;
        const matched = selectedTimes.filter(time => r.slots.includes(time));
        return matched.length > 0 ? { ...r, matched } : null;
    }).filter(Boolean);

    available.forEach(r => {
        const isBusy = liveBookings.some(b => b.room === r.room);
        resultsDiv.innerHTML += `
            <div onclick="${isMentor ? `openBooking('${r.room}')` : ''}" class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all cursor-pointer relative group">
                ${isBusy ? `<span class="absolute top-2 right-2 bg-red-100 text-red-600 text-[8px] font-black px-2 py-1 rounded">LIVE NOW</span>` : ''}
                <h3 class="text-xl font-black text-slate-800">${r.room}</h3>
                <p class="text-[9px] text-indigo-500 font-bold mt-2 uppercase tracking-tighter">Available in these slots:</p>
                <div class="mt-1 text-[10px] text-slate-500 space-y-1">
                    ${r.matched.map(m => `• ${m}`).join('<br>')}
                </div>
                ${isMentor ? `<p class="mt-4 text-[9px] font-black text-white bg-indigo-600 text-center py-2 rounded-lg">CLICK TO REGISTER CLASS</p>` : ''}
            </div>`;
    });
};

window.openBooking = function(roomName) {
    currentRoom = roomData.find(r => r.room === roomName && r.day === document.getElementById('daySelect').value);
    document.getElementById('bookRoomTitle').innerText = roomName;
    const list = document.getElementById('bookSlotList');
    list.innerHTML = "";
    currentRoom.slots.forEach(s => {
        list.innerHTML += `<label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-indigo-50 transition"><input type="checkbox" value="${s}" class="book-check w-5 h-5 rounded"> <span class="text-sm">${s}</span></label>`;
    });
    openModal('bookingModal');
};

window.submitBooking = function() {
    const wing = document.getElementById('wingSelect').value;
    const selected = Array.from(document.querySelectorAll('.book-check:checked')).map(c => c.value);
    if (!wing || selected.length === 0) return alert("Select wing and slots!");

    selected.forEach(s => {
        const id = Date.now() + Math.random().toString(36).substr(2, 9); // Unique ID
        const bookingData = {
            id: id,
            room: currentRoom.room,
            wing: wing,
            slot: s,
            endTime: s.split('-')[1].trim(),
            day: currentRoom.day
        };
        set(ref(db, 'bookings/' + id), bookingData);
    });

    alert("Class Registered!");
    closeModal('bookingModal');
    logout(); // Automatic exit mentor mode
};

// Live Status Sidebar
window.toggleLiveSidebar = function() {
    const sb = document.getElementById('liveSidebar');
    sb.classList.toggle('translate-x-full');
    updateLiveUI();
};

function updateLiveUI() {
    const now = new Date();
    const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const currentDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];

    const list = document.getElementById('sidebarLiveList');
    if(!list) return;

    // Auto-clear logic for Firebase
    liveBookings.forEach(b => {
        if (b.day !== currentDay || parseTime(b.endTime) <= parseTime(currentTime)) {
            remove(ref(db, 'bookings/' + b.id));
        }
    });

    list.innerHTML = liveBookings.length > 0 ? "" : `<p class="text-slate-400 italic text-center py-10">No live sessions currently.</p>`;
    liveBookings.forEach(b => {
        list.innerHTML += `
            <div class="p-4 bg-red-50 rounded-2xl border-l-4 border-red-600 shadow-sm">
                <p class="font-black text-slate-900">${b.room}</p>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-[9px] bg-red-600 text-white px-2 py-1 rounded font-bold">${b.wing}</span>
                    <span class="text-[10px] text-red-500 font-bold tracking-tighter italic">Ends: ${b.endTime}</span>
                </div>
                <p class="text-[9px] text-slate-400 mt-2 font-bold">${b.slot}</p>
            </div>`;
    });
}

// Utility
function parseTime(t) {
    const [time, mod] = t.split(' ');
    let [h, m] = time.split(':');
    if (h === '12') h = '00';
    return (mod === 'PM' ? parseInt(h) + 12 : parseInt(h)) * 60 + parseInt(m);
}

window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

// Start everything
init();