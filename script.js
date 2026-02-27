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

function init() {
    const grid = document.getElementById('periodGrid');
    if (grid) {
        grid.innerHTML = "";
        periods.forEach(p => {
            // Dark Blue color for Slot Selection (Indigo-950)
            grid.innerHTML += `<label class="bg-white/80 p-2 rounded-lg flex items-center gap-1 cursor-pointer border border-transparent hover:border-indigo-400 transition text-[8px] text-indigo-950 font-black"><input type="checkbox" value="${p}" class="p-check"> ${p}</label>`;
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
    } catch (e) { console.error("CSV Load Error"); }
}

function syncFirebase() {
    onValue(ref(db, 'bookings'), (snapshot) => {
        const data = snapshot.val();
        liveBookings = [];
        if (data) {
            Object.keys(data).forEach(key => { liveBookings.push({ firebaseKey: key, ...data[key] }); });
        }
        updateLiveUI();
        if(isMentor) refreshMentorPanel();
        searchRooms(); 
    });
}

window.loginMentor = function() {
    if (mentorCodes.includes(document.getElementById('mCodeInput').value)) {
        isMentor = true;
        document.getElementById('authArea').innerHTML = `<span class="bg-indigo-500 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase">Mentor Active</span>`;
        document.getElementById('mentorDashboard').classList.remove('hidden');
        closeModal('mentorModal');
        searchRooms();
    } else { alert("Invalid Code!"); }
};

window.logout = function() {
    isMentor = false;
    document.getElementById('authArea').innerHTML = `<button onclick="openModal('mentorModal')" class="bg-white text-indigo-950 px-3 py-2 rounded-lg text-[10px] font-black uppercase">Mentor Login</button>`;
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
        const clickAction = isMentor ? `onclick="openBooking('${r.room.replace(/'/g, "\\'")}')"` : "";
        
        resultsDiv.innerHTML += `
            <div ${clickAction} class="bg-white/95 p-6 rounded-[32px] shadow-2xl transition-all ${isMentor ? 'cursor-pointer hover:scale-105 border-2 border-indigo-400' : ''} relative overflow-hidden">
                ${isBusy ? `<span class="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black px-3 py-1 rounded-bl-xl animate-pulse">LIVE NOW</span>` : ''}
                
                <h3 class="text-2xl font-black text-indigo-950 mb-3">${r.room}</h3>
                <div class="space-y-1">
                    ${r.matched.map(m => `<p class="text-[11px] text-indigo-950 font-bold bg-indigo-50 px-2 py-1 rounded-md inline-block mr-1 mb-1 italic"> ${m}</p>`).join('')}
                </div>
                ${isMentor ? `<div class="mt-4 bg-indigo-600 text-white text-[10px] font-black text-center py-2 rounded-xl uppercase">Register This Room</div>` : ''}
            </div>`;
    });
};

window.openBooking = function(roomName) {
    currentRoom = roomData.find(r => r.room === roomName && r.day === document.getElementById('daySelect').value);
    document.getElementById('bookRoomTitle').innerText = roomName;
    const list = document.getElementById('bookSlotList');
    list.innerHTML = "";
    currentRoom.slots.forEach(s => {
        list.innerHTML += `<label class="flex items-center gap-3 p-4 bg-white/5 rounded-2xl cursor-pointer hover:bg-white/10 transition border border-white/5 mb-2"><input type="checkbox" value="${s}" class="book-check w-5 h-5 accent-indigo-500"> <span class="text-xs font-black text-white">${s}</span></label>`;
    });
    openModal('bookingModal');
};

window.submitBooking = function() {
    const wing = document.getElementById('wingSelect').value;
    const selected = Array.from(document.querySelectorAll('.book-check:checked')).map(c => c.value);
    if (!wing || selected.length === 0) return alert("Select Wing and Slots!");

    selected.forEach(s => {
        const id = Date.now() + "_" + Math.floor(Math.random() * 1000);
        set(ref(db, 'bookings/' + id), { room: currentRoom.room, wing, slot: s, endTime: s.split('-')[1].trim(), day: currentRoom.day });
    });
    alert("Room Registered Successfully!");
    closeModal('bookingModal');
};

window.cancelBooking = (fKey) => { remove(ref(db, 'bookings/' + fKey)).then(() => alert("Entry Removed")); };

function refreshMentorPanel() {
    const list = document.getElementById('myBookingsList');
    if(!list) return;
    list.innerHTML = liveBookings.length > 0 ? "" : `<p class="text-[10px] text-center py-8 text-white/30 font-bold uppercase tracking-widest">No active classes</p>`;
    liveBookings.forEach(b => {
        list.innerHTML += `<div class="bg-white/10 p-4 rounded-2xl flex justify-between items-center border border-white/10 shadow-xl"><div class="text-[11px] font-black"><span class="text-indigo-400">${b.room}</span><br><span class="text-white/60 font-normal">${b.slot}</span></div><button onclick="cancelBooking('${b.firebaseKey}')" class="bg-red-500/20 text-red-400 border border-red-500/50 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-red-500 hover:text-white transition-all">CANCEL</button></div>`;
    });
}

function updateLiveUI() {
    const list = document.getElementById('sidebarLiveList');
    if(!list) return;
    list.innerHTML = liveBookings.length > 0 ? "" : `<div class="text-center py-20"><div class="text-indigo-500/20 text-4xl mb-4">●</div><p class="text-white/20 font-black uppercase text-[10px] tracking-widest">Empty</p></div>`;
    liveBookings.forEach(b => {
        list.innerHTML += `<div class="p-5 bg-white/5 rounded-[24px] border border-indigo-500/20 shadow-inner group"><p class="font-black text-indigo-400 text-lg mb-1">${b.room}</p><div class="flex justify-between items-center"><span class="text-[9px] bg-indigo-500 text-white px-2 py-0.5 rounded font-black uppercase">${b.wing}</span><span class="text-[10px] text-white/40 font-bold italic">${b.endTime}</span></div></div>`;
    });
}

window.toggleLiveSidebar = () => document.getElementById('liveSidebar').classList.toggle('translate-x-full');
window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

init();