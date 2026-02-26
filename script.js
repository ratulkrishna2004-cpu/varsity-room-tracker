import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD7GsUQ9ez0xbDyQiQEp9xk9OPXCLXjgE8",
    authDomain: "varsity-room-tracker.firebaseapp.com",
    databaseURL: "https://varsity-room-tracker-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "varsity-room-tracker",
    storageBucket: "varsity-room-tracker.firebasestorage.app",
    messagingSenderId: "218185535738",
    appId: "1:218185535738:web:165a8a110842e3dd953943"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const periods = ["08:00 AM-08:50 AM", "08:50 AM-09:40 AM", "09:40 AM-10:30 AM", "10:30 AM-11:20 AM", "11:20 AM-12:10 PM", "12:10 PM-01:00 PM", "01:00 PM-01:50 PM", "01:50 PM-02:40 PM", "02:40 PM-03:30 PM", "03:30 PM-04:20 PM", "04:20 PM-05:10 PM", "05:10 PM-06:00 PM"];
const mentorCodes = ["RATUL2026"];
let isMentor = false, roomData = [], liveBookings = [], currentRoom = null;

// Initial Setup
function init() {
    const grid = document.getElementById('periodGrid');
    if (grid) {
        grid.innerHTML = "";
        periods.forEach(p => {
            grid.innerHTML += `<label class="bg-slate-50 p-2 rounded-lg flex items-center gap-1 cursor-pointer border border-transparent hover:border-indigo-200 transition text-[8px]"><input type="checkbox" value="${p}" class="p-check"> ${p}</label>`;
        });
    }
    loadCSV();
    syncFirebase();
}

async function loadCSV() {
    try {
        const res = await fetch('routine.csv');
        const text = await res.text();
        const rows = text.split('\n').filter(r => r.trim() !== "");
        roomData = rows.slice(1).map(row => {
            const parts = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (parts.length < 3) return null;
            return { day: parts[0].trim(), room: parts[1].replace(/"/g, "").trim(), slots: parts[2].replace(/"/g, "").split(',').map(s => s.trim()) };
        }).filter(Boolean);
    } catch (e) { console.error("CSV error"); }
}

function syncFirebase() {
    onValue(ref(db, 'bookings'), (snapshot) => {
        const data = snapshot.val();
        liveBookings = [];
        if (data) {
            Object.keys(data).forEach(key => {
                liveBookings.push({ firebaseKey: key, ...data[key] });
            });
        }
        updateLiveUI();
        if(isMentor) refreshMentorPanel();
        searchRooms(); 
    });
}

// ✅ Fix: HTML theke function pabar jonno window scope-e deya
window.loginMentor = function() {
    const code = document.getElementById('mCodeInput').value;
    if (mentorCodes.includes(code)) {
        isMentor = true;
        document.getElementById('authArea').innerHTML = `<span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-[10px] font-bold">MENTOR ACTIVE</span>`;
        document.getElementById('mentorDashboard').classList.remove('hidden');
        closeModal('mentorModal');
        refreshMentorPanel();
        searchRooms(); // Search refresh kora jate card-e click kaj kore
    } else { alert("Wrong Code"); }
};

window.logout = function() {
    isMentor = false;
    document.getElementById('authArea').innerHTML = `<button onclick="openModal('mentorModal')" class="bg-white text-indigo-900 px-3 py-2 rounded-lg text-xs font-bold shadow">MENTOR LOGIN</button>`;
    document.getElementById('mentorDashboard').classList.add('hidden');
    searchRooms();
};

window.searchRooms = function() {
    const day = document.getElementById('daySelect').value;
    const selected = Array.from(document.querySelectorAll('.p-check:checked')).map(c => c.value);
    const resultsDiv = document.getElementById('roomResults');
    if(!resultsDiv) return;
    resultsDiv.innerHTML = "";

    if (selected.length === 0) return;

    const available = roomData.map(r => {
        if (r.day.toLowerCase() !== day.toLowerCase()) return null;
        const matched = selected.filter(time => r.slots.includes(time));
        return matched.length > 0 ? { ...r, matched } : null;
    }).filter(Boolean);

    available.forEach(r => {
        const isBusy = liveBookings.some(b => b.room === r.room);
        // Mentor holei shudhu card-e click korle booking modal khulbe
        const clickAction = isMentor ? `onclick="openBooking('${r.room.replace(/'/g, "\\'")}')"` : "";
        
        resultsDiv.innerHTML += `
            <div ${clickAction} class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all ${isMentor ? 'cursor-pointer' : ''} relative">
                ${isBusy ? `<span class="absolute top-2 right-2 bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded animate-pulse">LIVE</span>` : ''}
                <h3 class="text-xl font-black text-slate-800">${r.room}</h3>
                <div class="mt-2 text-[10px] text-indigo-600 font-bold">
                    ${r.matched.map(m => `• ${m}`).join('<br>')}
                </div>
                ${isMentor ? `<p class="mt-4 text-[9px] font-black text-white bg-indigo-600 text-center py-2 rounded-lg uppercase">Book This Room</p>` : ''}
            </div>`;
    });
};

window.openBooking = function(roomName) {
    currentRoom = roomData.find(r => r.room === roomName && r.day === document.getElementById('daySelect').value);
    document.getElementById('bookRoomTitle').innerText = roomName;
    const list = document.getElementById('bookSlotList');
    list.innerHTML = "";
    currentRoom.slots.forEach(s => {
        list.innerHTML += `<label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" value="${s}" class="book-check w-4 h-4"> <span class="text-xs font-bold">${s}</span></label>`;
    });
    openModal('bookingModal');
};

window.submitBooking = function() {
    const wing = document.getElementById('wingSelect').value;
    const selected = Array.from(document.querySelectorAll('.book-check:checked')).map(c => c.value);
    
    if (!wing || selected.length === 0) {
        alert("Please select Wing and Slots!");
        return;
    }

    selected.forEach(s => {
        const bookingId = Date.now() + "_" + Math.floor(Math.random() * 1000);
        const bookingData = {
            room: currentRoom.room,
            wing: wing,
            slot: s,
            endTime: s.split('-')[1].trim(),
            day: currentRoom.day
        };
        // Firebase database-e data pathano
        set(ref(db, 'bookings/' + bookingId), bookingData);
    });

    alert("Booking Successful!");
    closeModal('bookingModal');
};

window.cancelBooking = function(fKey) {
    remove(ref(db, 'bookings/' + fKey)).then(() => alert("Cancelled!"));
};

function refreshMentorPanel() {
    const list = document.getElementById('myBookingsList');
    if(!list) return;
    list.innerHTML = liveBookings.length > 0 ? "" : `<p class="text-[10px] text-center py-4 text-slate-400 font-bold">NO CLASSES BOOKED</p>`;
    liveBookings.forEach(b => {
        list.innerHTML += `<div class="bg-white p-3 rounded-xl flex justify-between items-center border border-indigo-100 shadow-sm mb-2"><div class="text-[10px]"><b>${b.room}</b> (${b.wing})<br>${b.slot}</div><button onclick="cancelBooking('${b.firebaseKey}')" class="bg-red-500 text-white px-3 py-2 rounded-lg text-[10px] font-bold">CANCEL</button></div>`;
    });
}

window.toggleLiveSidebar = () => document.getElementById('liveSidebar').classList.toggle('translate-x-full');
window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

function updateLiveUI() {
    const list = document.getElementById('sidebarLiveList');
    if(!list) return;
    list.innerHTML = liveBookings.length > 0 ? "" : `<p class="text-slate-400 italic text-center py-10 text-xs">No active sessions.</p>`;
    liveBookings.forEach(b => {
        list.innerHTML += `<div class="p-4 bg-red-50 rounded-2xl border-l-4 border-red-600 shadow-sm mb-3"><p class="font-black text-slate-900">${b.room}</p><p class="text-[9px] text-red-600 font-bold uppercase">${b.wing} | Till: ${b.endTime}</p></div>`;
    });
}

init();