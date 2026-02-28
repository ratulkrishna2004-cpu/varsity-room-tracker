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
const mentors = [{ name: "Ratul Krishna Mojumder", code: "RATUL2026" }];

let currentMentor = null, roomData = [], liveBookings = [], currentRoom = null;

function init() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const now = new Date();
    document.getElementById('displayToday').innerText = days[now.getDay()];
    document.getElementById('dateSelect').value = now.toISOString().split('T')[0];

    const grid = document.getElementById('periodGrid');
    periods.forEach(p => {
        grid.innerHTML += `<label class="bg-white/80 p-2 rounded-lg flex items-center gap-1 cursor-pointer text-[8px] text-indigo-950 font-black"><input type="checkbox" value="${p}" class="p-check"> ${p}</label>`;
    });

    loadCSV();
    syncFirebase();
    setInterval(autoCleanup, 60000);
}

window.updateDayDisplay = function() {
    const dateVal = document.getElementById('dateSelect').value;
    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(dateVal).getDay()];
    document.getElementById('dayStatus').innerHTML = `<span class="text-indigo-300 font-bold uppercase text-[10px]">${dayName}</span>`;
    searchRooms();
};

function autoCleanup() {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.getHours() * 100 + now.getMinutes();

    liveBookings.forEach(b => {
        if (b.date < currentDate) {
            remove(ref(db, 'bookings/' + b.firebaseKey));
        } else if (b.date === currentDate) {
            const [time, mod] = b.endTime.split(' ');
            let [h, m] = time.split(':').map(Number);
            if (mod === 'PM' && h < 12) h += 12;
            if (mod === 'AM' && h === 12) h = 0;
            if (currentTime >= (h * 100 + m)) remove(ref(db, 'bookings/' + b.firebaseKey));
        }
    });
}

async function loadCSV() {
    const res = await fetch('routine.csv');
    const text = await res.text();
    const rows = text.split('\n').filter(r => r.trim() !== "");
    roomData = rows.slice(1).map(row => {
        const p = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        return { day: p[0].trim(), room: p[1].replace(/"/g, "").trim(), slots: p[2].replace(/"/g, "").split(',').map(s => s.trim()) };
    });
}

function syncFirebase() {
    onValue(ref(db, 'bookings'), (snap) => {
        const data = snap.val();
        liveBookings = data ? Object.keys(data).map(key => ({ firebaseKey: key, ...data[key] })) : [];
        updateLiveUI();
        searchRooms();
    });
}

window.loginMentor = function() {
    const found = mentors.find(m => m.code === document.getElementById('mCodeInput').value);
    if (found) {
        currentMentor = found;
        document.getElementById('calendarArea').classList.remove('hidden');
        document.getElementById('todayStatusArea').classList.add('hidden');
        document.getElementById('authArea').innerHTML = `<span class="bg-green-600 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase">Hi, ${found.name.split(' ')[0]}</span>`;
        closeModal('mentorModal');
        searchRooms();
    } else { alert("Invalid Code!"); }
};

window.searchRooms = function() {
    const dateInput = document.getElementById('dateSelect').value;
    const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(dateInput).getDay()];
    const selectedSlots = Array.from(document.querySelectorAll('.p-check:checked')).map(c => c.value);
    const resultsDiv = document.getElementById('roomResults');
    resultsDiv.innerHTML = "";
    if (selectedSlots.length === 0) return;

    roomData.filter(r => r.day.toLowerCase() === day.toLowerCase()).forEach(r => {
        const matched = selectedSlots.filter(s => r.slots.includes(s));
        if (matched.length === 0) return;
        const isBusy = liveBookings.some(b => b.room === r.room && b.date === dateInput);
        
        resultsDiv.innerHTML += `
            <div onclick="${currentMentor ? `openBooking('${r.room}')` : ''}" class="bg-white/95 p-6 rounded-[32px] shadow-2xl relative ${currentMentor ? 'cursor-pointer hover:scale-105' : ''} transition-all">
                ${isBusy ? `<span class="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black px-3 py-1 rounded-bl-xl">BOOKED</span>` : ''}
                <h3 class="text-2xl font-black text-indigo-950 mb-3">${r.room}</h3>
                <div class="space-y-1">${matched.map(m => `<p class="text-[10px] text-indigo-900 font-bold bg-indigo-50 px-2 py-1 rounded inline-block mr-1">${m}</p>`).join('')}</div>
            </div>`;
    });
};

window.openBooking = function(roomName) {
    const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(document.getElementById('dateSelect').value).getDay()];
    currentRoom = roomData.find(r => r.room === roomName && r.day === day);
    document.getElementById('bookRoomTitle').innerText = roomName;
    const list = document.getElementById('bookSlotList');
    list.innerHTML = currentRoom.slots.map(s => `<label class="flex items-center gap-3 p-4 bg-white/5 rounded-2xl cursor-pointer hover:bg-white/10 mb-2 border border-white/5"><input type="checkbox" value="${s}" class="book-check w-5 h-5 accent-indigo-500"> <span class="text-xs font-black text-white">${s}</span></label>`).join('');
    openModal('bookingModal');
};

window.submitBooking = function() {
    const wing = document.getElementById('wingSelect').value;
    const selected = Array.from(document.querySelectorAll('.book-check:checked')).map(c => c.value);
    const date = document.getElementById('dateSelect').value;
    if (!wing || selected.length === 0) return alert("Select Wing and Slots!");
    selected.forEach(s => {
        set(ref(db, 'bookings/' + (Date.now() + Math.random())), { room: currentRoom.room, wing, slot: s, endTime: s.split('-')[1].trim(), date, mentor: currentMentor.name });
    });
    alert("Booked!"); closeModal('bookingModal');
};

function updateLiveUI() {
    const list = document.getElementById('sidebarLiveList');
    liveBookings.sort((a,b) => new Date(a.date) - new Date(b.date));
    list.innerHTML = liveBookings.length > 0 ? "" : `<p class="text-white/20 text-center py-10 font-black text-[10px]">No Live Classes</p>`;
    liveBookings.forEach(b => {
        const isToday = b.date === new Date().toISOString().split('T')[0];
        list.innerHTML += `
            <div class="p-5 bg-white/5 rounded-[24px] border ${isToday ? 'border-green-500/40' : 'border-indigo-500/20'} mb-4">
                <div class="flex justify-between items-start mb-2"><p class="font-black text-indigo-400 text-lg">${b.room}</p><span class="text-[9px] ${isToday ? 'bg-green-600' : 'bg-white/10'} text-white px-2 py-0.5 rounded font-black">${isToday ? 'TODAY' : b.date}</span></div>
                <p class="text-[10px] text-white/80 font-bold mb-1 italic">${b.slot}</p>
                <p class="text-[8px] text-white/40 font-bold uppercase mb-3">Date: ${b.date}</p>
                <div class="flex justify-between items-center pt-3 border-t border-white/5"><span class="text-[9px] bg-indigo-500 text-white px-2 py-0.5 rounded font-black uppercase">${b.wing}</span><span class="text-[9px] text-green-400 font-black">By: ${b.mentor}</span></div>
            </div>`;
    });
}

window.toggleLiveSidebar = () => document.getElementById('liveSidebar').classList.toggle('translate-x-full');
window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

init();