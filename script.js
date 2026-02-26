import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// Firebase Config
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

// Initial UI
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
            return { 
                day: parts[0].trim(), 
                room: parts[1].replace(/"/g, "").trim(), 
                slots: parts[2].replace(/"/g, "").split(',').map(s => s.trim()) 
            };
        });
    } catch (e) { console.error("CSV error"); }
}

function syncFirebase() {
    onValue(ref(db, 'bookings'), (snapshot) => {
        const data = snapshot.val();
        liveBookings = data ? Object.values(data) : [];
        updateLiveUI();
        if(isMentor) refreshMentorPanel();
        searchRooms(); 
    });
}

// Global Exports
window.loginMentor = () => {
    const code = document.getElementById('mCodeInput').value;
    if (mentorCodes.includes(code)) {
        isMentor = true;
        document.getElementById('authArea').innerHTML = `<span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-[10px] font-bold">MENTOR ACTIVE</span>`;
        document.getElementById('mentorDashboard').classList.remove('hidden');
        closeModal('mentorModal');
        refreshMentorPanel();
        searchRooms();
    } else { alert("Invalid Code"); }
};

window.logout = () => {
    isMentor = false;
    document.getElementById('authArea').innerHTML = `<button onclick="openModal('mentorModal')" class="bg-white text-indigo-900 px-3 py-2 rounded-lg text-xs font-bold shadow">MENTOR LOGIN</button>`;
    document.getElementById('mentorDashboard').classList.add('hidden');
    searchRooms();
};

window.searchRooms = () => {
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
        resultsDiv.innerHTML += `
            <div onclick="${isMentor ? `openBooking('${r.room}')` : ''}" class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all cursor-pointer relative group">
                ${isBusy ? `<span class="absolute top-2 right-2 bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded animate-pulse">LIVE</span>` : ''}
                <h3 class="text-xl font-black text-slate-800">${r.room}</h3>
                <p class="text-[9px] text-indigo-500 font-bold mt-2 uppercase">Available Slots:</p>
                <div class="mt-1 text-[10px] text-slate-500 leading-relaxed font-medium">
                    ${r.matched.map(m => `• ${m}`).join('<br>')}
                </div>
                ${isMentor ? `<p class="mt-4 text-[9px] font-black text-white bg-indigo-600 text-center py-2 rounded-lg opacity-90 hover:opacity-100">BOOK ROOM</p>` : ''}
            </div>`;
    });
};

window.openBooking = (roomName) => {
    currentRoom = roomData.find(r => r.room === roomName && r.day === document.getElementById('daySelect').value);
    document.getElementById('bookRoomTitle').innerText = roomName;
    const list = document.getElementById('bookSlotList');
    list.innerHTML = "";
    currentRoom.slots.forEach(s => {
        list.innerHTML += `<label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-indigo-50 transition"><input type="checkbox" value="${s}" class="book-check w-4 h-4"> <span class="text-xs font-bold text-slate-700">${s}</span></label>`;
    });
    openModal('bookingModal');
};

window.submitBooking = () => {
    const wing = document.getElementById('wingSelect').value;
    const selected = Array.from(document.querySelectorAll('.book-check:checked')).map(c => c.value);
    if (!wing || selected.length === 0) return alert("Select Wing and Time Slots!");

    selected.forEach(s => {
        const id = "ID-" + Date.now() + Math.floor(Math.random() * 100);
        set(ref(db, 'bookings/' + id), { 
            id, 
            room: currentRoom.room, 
            wing, 
            slot: s, 
            endTime: s.split('-')[1].trim(), 
            day: currentRoom.day 
        });
    });
    alert("Booking Successful!");
    closeModal('bookingModal');
    logout();
};

window.cancelBooking = (id) => {
    remove(ref(db, 'bookings/' + id)).then(() => {
        alert("Booking Removed");
        logout();
    });
};

function refreshMentorPanel() {
    const list = document.getElementById('myBookingsList');
    if(!list) return;
    list.innerHTML = liveBookings.length > 0 ? "" : `<p class="text-[10px] text-center py-4 text-slate-400 italic font-bold">NO CLASSES REGISTERED BY MENTORS</p>`;
    liveBookings.forEach(b => {
        list.innerHTML += `
            <div class="bg-white p-3 rounded-xl flex justify-between items-center border border-indigo-100 shadow-sm">
                <div class="text-[10px] leading-tight text-slate-700"><b>${b.room}</b> (${b.wing})<br>${b.slot}</div>
                <button onclick="cancelBooking('${b.id}')" class="bg-red-500 text-white px-3 py-2 rounded-lg text-[10px] font-bold shadow-sm hover:bg-red-600 transition">CANCEL</button>
            </div>`;
    });
}

window.toggleLiveSidebar = () => document.getElementById('liveSidebar').classList.toggle('translate-x-full');

function updateLiveUI() {
    const list = document.getElementById('sidebarLiveList');
    if(!list) return;
    
    // Automatic Clear logic (Frontend side)
    const now = new Date();
    const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const currentDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];

    list.innerHTML = liveBookings.length > 0 ? "" : `<p class="text-slate-400 italic text-center py-10 text-xs">No active sessions.</p>`;
    
    liveBookings.forEach(b => {
        // Auto-clear from DB if time passed or day changed
        if(b.day !== currentDay || parseTime(b.endTime) <= parseTime(currentTime)) {
            remove(ref(db, 'bookings/' + b.id));
            return;
        }

        list.innerHTML += `
            <div class="p-4 bg-red-50 rounded-2xl border-l-4 border-red-600 shadow-sm">
                <p class="font-black text-slate-900">${b.room}</p>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded font-bold uppercase">${b.wing}</span>
                    <span class="text-[10px] text-red-500 font-black italic">Till: ${b.endTime}</span>
                </div>
            </div>`;
    });
}

function parseTime(t) {
    const [time, mod] = t.split(' ');
    let [h, m] = time.split(':');
    if (h === '12') h = '00';
    return (mod === 'PM' ? parseInt(h) + 12 : parseInt(h)) * 60 + parseInt(m);
}

window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

// Start Logic
init();