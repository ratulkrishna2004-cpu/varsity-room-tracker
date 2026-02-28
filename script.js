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
const mentors = [{ name: "Ratul Krishna Mojumder", code: "RATUL2026" },
                { name: "Mrinmoy Paul Kabbo", code: "Kabbo20" }];

let currentMentor = null, roomData = [], liveBookings = [], currentRoom = null;

function init() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const now = new Date();
    if(document.getElementById('daySelect')) document.getElementById('daySelect').value = days[now.getDay()] || "Sunday";
    if(document.getElementById('dateSelect')) document.getElementById('dateSelect').value = now.toISOString().split('T')[0];

    const grid = document.getElementById('periodGrid');
    grid.innerHTML = periods.map(p => `
        <label class="bg-white/10 p-3 rounded-2xl flex items-center gap-2 cursor-pointer text-[9px] text-white/80 font-bold hover:bg-white/20 transition border border-white/5">
            <input type="checkbox" value="${p}" class="p-check w-4 h-4 accent-indigo-500"> ${p}
        </label>`).join('');

    loadCSV();
    syncFirebase();
    setInterval(autoCleanup, 60000);
}

window.loginMentor = function() {
    const code = document.getElementById('mCodeInput').value;
    const found = mentors.find(m => m.code === code);
    if (found) {
        currentMentor = found;
        document.getElementById('mentorDashboard').classList.remove('hidden');
        document.getElementById('mentorNameDisplay').innerText = found.name;
        document.getElementById('mentorView').classList.remove('hidden');
        document.getElementById('userView').classList.add('hidden');
        document.getElementById('authArea').innerHTML = `<span class="bg-green-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Verified</span>`;
        closeModal('mentorModal');
        updateMentorDashboard();
        searchRooms();
    } else alert("Invalid Code!");
};

window.logout = function() { window.location.reload(); };

async function loadCSV() {
    try {
        const res = await fetch('routine.csv');
        const text = await res.text();
        const rows = text.split('\n').filter(r => r.trim() !== "");
        roomData = rows.slice(1).map(row => {
            const p = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            return { day: p[0].trim(), room: p[1].replace(/"/g, "").trim(), slots: p[2].replace(/"/g, "").split(',').map(s => s.trim()) };
        });
    } catch(e) { console.error("CSV error"); }
}

function syncFirebase() {
    onValue(ref(db, 'bookings'), (snap) => {
        const data = snap.val();
        liveBookings = data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : [];
        updateLiveUI();
        if (currentMentor) updateMentorDashboard();
        searchRooms();
    });
}

window.searchRooms = function() {
    const div = document.getElementById('roomResults'); div.innerHTML = "";
    let day, date;
    if (currentMentor) {
        date = document.getElementById('dateSelect').value;
        day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(date).getDay()];
    } else {
        day = document.getElementById('daySelect').value;
        date = new Date().toISOString().split('T')[0];
    }
    const selected = Array.from(document.querySelectorAll('.p-check:checked')).map(c => c.value);
    if (selected.length === 0) return;

    roomData.filter(r => r.day.toLowerCase() === day.toLowerCase()).forEach(r => {
        const matched = selected.filter(s => r.slots.includes(s));
        if (matched.length === 0) return;
        const busy = liveBookings.some(b => b.room === r.room && b.date === date);

        div.innerHTML += `
            <div class="bg-white/95 p-8 rounded-[40px] shadow-2xl relative transition-all hover:-translate-y-1">
                ${busy ? `<span class="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-black px-4 py-1.5 rounded-bl-2xl uppercase animate-pulse">Occupied</span>` : ''}
                <h3 class="text-3xl font-black text-indigo-950 mb-4 italic uppercase tracking-tighter">${r.room}</h3>
                <div class="mb-6 flex flex-wrap gap-1">${matched.map(m => `<span class="text-[9px] text-indigo-900 font-black bg-indigo-100 px-3 py-1.5 rounded-xl uppercase">${m}</span>`).join('')}</div>
                ${currentMentor && !busy ? `<button onclick="openBooking('${r.room}', '${day}')" class="w-full bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all">Book Now</button>` : ''}
            </div>`;
    });
};

window.openBooking = function(room, day) {
    currentRoom = roomData.find(r => r.room === room && r.day === day);
    document.getElementById('bookRoomTitle').innerText = room;
    document.getElementById('bookSlotList').innerHTML = currentRoom.slots.map(s => `
        <label class="flex items-center gap-4 p-5 bg-white/5 rounded-[24px] cursor-pointer hover:bg-white/10 mb-2 border border-white/5 transition-all">
            <input type="checkbox" value="${s}" class="book-check w-5 h-5 accent-indigo-500"> 
            <span class="text-sm font-black text-white tracking-tight">${s}</span>
        </label>`).join('');
    openModal('bookingModal');
};

window.submitBooking = function() {
    const wing = document.getElementById('wingSelect').value;
    const selected = Array.from(document.querySelectorAll('.book-check:checked')).map(c => c.value);
    const date = document.getElementById('dateSelect').value;
    if (!wing || selected.length === 0) return alert("Select Wing and Slots!");

    selected.forEach(s => {
        const key = Date.now() + "_" + Math.floor(Math.random() * 1000);
        set(ref(db, 'bookings/' + key), { 
            room: currentRoom.room, wing, slot: s, endTime: s.split('-')[1].trim(), date, mentor: currentMentor.name 
        });
    });
    alert("Success! Room " + currentRoom.room + " Registered.");
    closeModal('bookingModal');
};

function updateLiveUI() {
    const l = document.getElementById('sidebarLiveList'); l.innerHTML = "";
    if(liveBookings.length === 0) {
        l.innerHTML = `<div class="py-20 text-center opacity-20"><p class="text-[10px] font-black uppercase tracking-widest">No Active Bookings</p></div>`;
        return;
    }
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    liveBookings.sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(b => {
        const dayName = days[new Date(b.date).getDay()];
        l.innerHTML += `
            <div class="p-6 bg-white/5 rounded-[32px] border border-white/10 mb-4">
                <div class="flex justify-between items-start mb-1"><p class="font-black text-indigo-400 text-xl italic tracking-tighter">${b.room}</p><span class="text-[9px] bg-white/10 px-3 py-1 rounded-xl text-white font-black uppercase">${b.wing}</span></div>
                <p class="text-[10px] text-indigo-300 font-black mb-3">${b.date} (${dayName})</p>
                <p class="text-[11px] text-white/70 font-bold mb-4 italic">${b.slot}</p>
                <div class="pt-4 border-t border-white/5"><p class="text-[9px] text-green-400 font-black italic uppercase tracking-tighter">By: ${b.mentor}</p></div>
            </div>`;
    });
}

function updateMentorDashboard() {
    const myList = document.getElementById('myBookingsList'); myList.innerHTML = "";
    const myClasses = liveBookings.filter(b => b.mentor === currentMentor.name);
    if(myClasses.length === 0) {
        myList.innerHTML = `<p class="text-white/30 text-[9px] font-bold uppercase py-4 italic">No active bookings under your name.</p>`;
        return;
    }
    myClasses.forEach(b => {
        myList.innerHTML += `
            <div class="p-4 bg-white/5 rounded-2xl border border-green-500/20 shadow-lg relative">
                <div class="flex justify-between items-center mb-2"><p class="font-black text-white text-sm uppercase">${b.room}</p><span class="text-[8px] text-white/50">${b.date}</span></div>
                <p class="text-[9px] text-indigo-300 font-bold mb-3 italic">${b.slot}</p>
                <button onclick="cancelBooking('${b.id}')" class="w-full bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white py-2 rounded-lg text-[9px] font-black uppercase transition-all border border-red-500/30">Cancel My Class</button>
            </div>`;
    });
}

window.cancelBooking = function(id) {
    if (!currentMentor) return;
    if (confirm("Confirm cancellation? It will be removed from Live Status.")) {
        remove(ref(db, 'bookings/' + id)).then(() => alert("Cancelled!")).catch(err => console.error(err));
    }
};

function autoCleanup() {
    const now = new Date();
    const curD = now.toISOString().split('T')[0];
    const curT = now.getHours() * 100 + now.getMinutes();
    liveBookings.forEach(b => {
        if (b.date < curD) remove(ref(db, 'bookings/' + b.id));
        else if (b.date === curD) {
            const [t, m] = b.endTime.split(' ');
            let [h, min] = t.split(':').map(Number);
            if (m === 'PM' && h < 12) h += 12; if (m === 'AM' && h === 12) h = 0;
            if (curT >= (h * 100 + min)) remove(ref(db, 'bookings/' + b.id));
        }
    });
}

window.toggleLiveSidebar = () => document.getElementById('liveSidebar').classList.toggle('translate-x-full');
window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');


init();
