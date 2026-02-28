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
    document.getElementById('daySelect').value = days[now.getDay()] || "Sunday";
    document.getElementById('dateSelect').value = now.toISOString().split('T')[0];

    const grid = document.getElementById('periodGrid');
    periods.forEach(p => {
        grid.innerHTML += `<label class="bg-white/80 p-2 rounded-lg flex items-center gap-1 cursor-pointer text-[8px] text-indigo-950 font-black"><input type="checkbox" value="${p}" class="p-check"> ${p}</label>`;
    });

    loadCSV();
    syncFirebase();
    setInterval(autoCleanup, 60000);
}

function autoCleanup() {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.getHours() * 100 + now.getMinutes();
    liveBookings.forEach(b => {
        if (b.date < currentDate) remove(ref(db, 'bookings/' + b.id));
        else if (b.date === currentDate) {
            const [time, mod] = b.endTime.split(' ');
            let [h, m] = time.split(':').map(Number);
            if (mod === 'PM' && h < 12) h += 12; if (mod === 'AM' && h === 12) h = 0;
            if (currentTime >= (h * 100 + m)) remove(ref(db, 'bookings/' + b.id));
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
        liveBookings = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        updateLiveUI();
        searchRooms();
    });
}

window.loginMentor = function() {
    const found = mentors.find(m => m.code === document.getElementById('mCodeInput').value);
    if (found) {
        currentMentor = found;
        document.getElementById('mentorView').classList.remove('hidden');
        document.getElementById('userView').classList.add('hidden');
        document.getElementById('authArea').innerHTML = `<span class="bg-green-600 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest">Mentor Active</span>`;
        closeModal('mentorModal');
        searchRooms();
    } else alert("Invalid!");
};

window.searchRooms = function() {
    const resultsDiv = document.getElementById('roomResults');
    resultsDiv.innerHTML = "";
    
    let day, date;
    if (currentMentor) {
        date = document.getElementById('dateSelect').value;
        day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(date).getDay()];
    } else {
        day = document.getElementById('daySelect').value;
        date = new Date().toISOString().split('T')[0];
    }

    const selectedSlots = Array.from(document.querySelectorAll('.p-check:checked')).map(c => c.value);
    if (selectedSlots.length === 0) return;

    roomData.filter(r => r.day.toLowerCase() === day.toLowerCase()).forEach(r => {
        const matched = selectedSlots.filter(s => r.slots.includes(s));
        if (matched.length === 0) return;
        const isBusy = liveBookings.some(b => b.room === r.room && b.date === date);

        resultsDiv.innerHTML += `
            <div class="bg-white/95 p-6 rounded-[32px] shadow-2xl relative transition-all">
                ${isBusy ? `<span class="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black px-3 py-1 rounded-bl-xl">BOOKED</span>` : ''}
                <h3 class="text-2xl font-black text-indigo-950 mb-3 uppercase italic">${r.room}</h3>
                <div class="mb-4">${matched.map(m => `<p class="text-[9px] text-indigo-900 font-bold bg-indigo-50 px-2 py-1 rounded inline-block mr-1 mb-1">${m}</p>`).join('')}</div>
                ${currentMentor && !isBusy ? `<button onclick="openBooking('${r.room}', '${day}')" class="w-full bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-black uppercase">Book Now</button>` : ''}
            </div>`;
    });
};

window.openBooking = function(roomName, day) {
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
    if (!wing || selected.length === 0) return alert("Missing Info!");

    selected.forEach(s => {
        const id = Date.now() + Math.random();
        set(ref(db, 'bookings/' + id), { room: currentRoom.room, wing, slot: s, endTime: s.split('-')[1].trim(), date, mentor: currentMentor.name });
    });
    alert("Booked Successfully!"); closeModal('bookingModal');
};

function updateLiveUI() {
    const list = document.getElementById('sidebarLiveList');
    list.innerHTML = "";
    liveBookings.sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(b => {
        list.innerHTML += `
            <div class="p-5 bg-white/5 rounded-[24px] border border-indigo-500/20 mb-4 shadow-lg">
                <div class="flex justify-between items-center mb-2"><p class="font-black text-indigo-400 text-lg">${b.room}</p><span class="text-[8px] bg-white/10 px-2 py-1 rounded text-white/50">${b.date}</span></div>
                <p class="text-[10px] text-white font-bold mb-1 italic">${b.slot}</p>
                <div class="flex justify-between items-center pt-3 border-t border-white/5">
                    <span class="text-[9px] bg-indigo-500 text-white px-2 py-0.5 rounded font-black uppercase">${b.wing}</span>
                    <span class="text-[9px] text-green-400 font-black tracking-tighter italic">By: ${b.mentor}</span>
                </div>
            </div>`;
    });
}

window.toggleLiveSidebar = () => document.getElementById('liveSidebar').classList.toggle('translate-x-full');
window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

init();