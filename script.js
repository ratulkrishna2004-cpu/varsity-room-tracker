const periods = ["08:00 AM-08:50 AM", "08:50 AM-09:40 AM", "09:40 AM-10:30 AM", "10:30 AM-11:20 AM", "11:20 AM-12:10 PM", "12:10 PM-01:00 PM", "01:00 PM-01:50 PM", "01:50 PM-02:40 PM", "02:40 PM-03:30 PM", "03:30 PM-04:20 PM", "04:20 PM-05:10 PM", "05:10 PM-06:00 PM"];
const mentorCodes = ["RATUL2026"];
let isMentor = false, roomData = [], liveBookings = [], currentRoom = null;

// Initial Setup
function init() {
    const grid = document.getElementById('periodGrid');
    periods.forEach(p => {
        grid.innerHTML += `<label class="bg-slate-50 p-2 rounded-lg flex items-center gap-2 cursor-pointer border border-transparent hover:border-indigo-200 transition text-[9px]"><input type="checkbox" value="${p}" class="p-check"> ${p}</label>`;
    });
    loadCSV();
    loadStorage();
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
    } catch (e) { console.error("CSV Error"); }
}

// Mentor Logic
function loginMentor() {
    if (mentorCodes.includes(document.getElementById('mCodeInput').value)) {
        isMentor = true;
        document.getElementById('authArea').innerHTML = `<button onclick="logout()" class="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-bold underline">EXIT MENTOR</button>`;
        document.getElementById('mentorDashboard').classList.remove('hidden');
        closeModal('mentorModal');
        refreshMentorView();
        searchRooms();
    } else { alert("Wrong Access Code!"); }
}

function logout() {
    isMentor = false;
    document.getElementById('authArea').innerHTML = `<button onclick="openModal('mentorModal')" class="bg-white text-indigo-900 px-3 py-2 rounded-lg text-xs font-bold">MENTOR LOGIN</button>`;
    document.getElementById('mentorDashboard').classList.add('hidden');
    searchRooms();
}

function refreshMentorView() {
    const list = document.getElementById('myBookingsList');
    list.innerHTML = "";
    liveBookings.forEach((b, idx) => {
        list.innerHTML += `
            <div class="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm border border-indigo-100">
                <div class="text-xs"><b>${b.room}</b> (${b.wing}) <br> <span class="text-slate-400">${b.slot}</span></div>
                <button onclick="cancelBooking(${idx})" class="bg-red-600 text-white px-3 py-2 rounded-lg text-[10px] font-bold">CANCEL & LOGOUT</button>
            </div>`;
    });
}

function cancelBooking(index) {
    liveBookings.splice(index, 1);
    saveStorage();
    alert("Booking Cancelled!");
    logout();
    updateLiveUI();
}

// Booking System
function openBooking(roomName) {
    currentRoom = roomData.find(r => r.room === roomName && r.day === document.getElementById('daySelect').value);
    document.getElementById('bookRoomTitle').innerText = roomName;
    const list = document.getElementById('bookSlotList');
    list.innerHTML = "";
    currentRoom.slots.forEach(s => {
        list.innerHTML += `<label class="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" value="${s}" class="book-check"> ${s}</label>`;
    });
    openModal('bookingModal');
}

function submitBooking() {
    const wing = document.getElementById('wingSelect').value;
    const selected = Array.from(document.querySelectorAll('.book-check:checked')).map(c => c.value);
    if (!wing || selected.length === 0) return alert("Select Wing & Slots!");

    selected.forEach(s => {
        liveBookings.push({ room: currentRoom.room, wing: wing, slot: s, endTime: s.split('-')[1].trim(), day: currentRoom.day });
    });
    saveStorage();
    alert("Booking Successful!");
    closeModal('bookingModal');
    logout();
    updateLiveUI();
}

// Search Logic
function searchRooms() {
    const day = document.getElementById('daySelect').value;
    const selectedTimes = Array.from(document.querySelectorAll('.p-check:checked')).map(c => c.value);
    const resultsDiv = document.getElementById('roomResults');
    resultsDiv.innerHTML = "";

    if (selectedTimes.length === 0) return alert("Select time slots first!");

    const available = roomData.map(r => {
        if (r.day.toLowerCase() !== day.toLowerCase()) return null;
        const matched = selectedTimes.filter(time => r.slots.includes(time));
        return matched.length > 0 ? { ...r, matched } : null;
    }).filter(Boolean);

    available.forEach(r => {
        const isBusy = liveBookings.some(b => b.room === r.room);
        resultsDiv.innerHTML += `
            <div onclick="${isMentor ? `openBooking('${r.room}')` : ''}" class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all cursor-pointer relative group">
                ${isBusy ? `<span class="absolute top-2 right-2 bg-red-100 text-red-600 text-[8px] font-black px-2 py-1 rounded">IN USE</span>` : ''}
                <h3 class="text-xl font-black text-slate-800">${r.room}</h3>
                <p class="text-[9px] text-indigo-500 font-bold mt-1 uppercase">Matches: ${r.matched.length} slots</p>
                ${isMentor ? `<p class="mt-4 text-[9px] font-black text-indigo-700 bg-indigo-50 text-center py-2 rounded-lg opacity-0 group-hover:opacity-100 transition">BOOK THIS ROOM</p>` : ''}
            </div>`;
    });
}

// Live Status Sidebar Logic
function toggleLiveSidebar() {
    const sb = document.getElementById('liveSidebar');
    sb.classList.toggle('translate-x-full');
    updateLiveUI();
}

function updateLiveUI() {
    const now = new Date();
    const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const currentDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];

    // Auto-clear logic
    liveBookings = liveBookings.filter(b => b.day === currentDay && parseTime(b.endTime) > parseTime(currentTime));
    saveStorage();

    const list = document.getElementById('sidebarLiveList');
    list.innerHTML = liveBookings.length > 0 ? "" : `<p class="text-gray-400 italic">No classes running right now.</p>`;
    liveBookings.forEach(b => {
        list.innerHTML += `
            <div class="p-4 bg-indigo-50 rounded-2xl border-l-4 border-indigo-600">
                <p class="font-black text-indigo-900">${b.room}</p>
                <p class="text-[10px] text-indigo-400 font-bold uppercase mt-1">Wing: ${b.wing} | Till: ${b.endTime}</p>
            </div>`;
    });
}

function parseTime(t) {
    const [time, mod] = t.split(' ');
    let [h, m] = time.split(':');
    if (h === '12') h = '00';
    return (mod === 'PM' ? parseInt(h) + 12 : parseInt(h)) * 60 + parseInt(m);
}

// Utility
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function saveStorage() { localStorage.setItem('ratul_pro_data', JSON.stringify(liveBookings)); }
function loadStorage() { 
    const d = localStorage.getItem('ratul_pro_data');
    if(d) liveBookings = JSON.parse(d);
    updateLiveUI();
}

setInterval(updateLiveUI, 30000);
init();