const periods = [
    "08:00 AM-08:50 AM", "08:50 AM-09:40 AM", "09:40 AM-10:30 AM",
    "10:30 AM-11:20 AM", "11:20 AM-12:10 PM", "12:10 PM-01:00 PM",
    "01:00 PM-01:50 PM", "01:50 PM-02:40 PM", "02:40 PM-03:30 PM",
    "03:30 PM-04:20 PM", "04:20 PM-05:10 PM", "05:10 PM-06:00 PM"
];

const mentorCodes = ["RATUL2026" , "MRINMOY20"]; 
let isMentor = false;
let roomData = [];
let liveBookings = [];
let selectedWing = "";
let currentBookingRoom = null;

// Initialization
function init() {
    const grid = document.getElementById('periodGrid');
    periods.forEach(p => {
        grid.innerHTML += `
            <label class="border-2 border-gray-100 p-3 rounded-xl flex items-center gap-2 cursor-pointer bg-gray-50 hover:border-blue-300 transition-all">
                <input type="checkbox" value="${p}" class="p-check w-4 h-4 rounded"> ${p}
            </label>`;
    });
    loadCSV();
    loadFromStorage();
}

async function loadCSV() {
    try {
        const response = await fetch('routine.csv');
        const text = await response.text();
        const rows = text.split('\n').filter(r => r.trim() !== "");
        roomData = rows.slice(1).map(row => {
            const parts = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if(parts.length < 3) return null;
            return {
                day: parts[0].trim(),
                room: parts[1].replace(/"/g, "").trim(),
                slots: parts[2].replace(/"/g, "").split(',').map(s => s.trim())
            };
        }).filter(Boolean);
    } catch (e) { console.error("CSV Load Error"); }
}

// Mentor Auth
function loginMentor() {
    const input = document.getElementById('mCodeInput').value;
    if (mentorCodes.includes(input)) {
        isMentor = true;
        document.getElementById('navButtons').innerHTML = `<button onclick="logout()" class="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold text-sm">Logout</button>`;
        document.getElementById('uiTitle').innerText = "Mentor Dashboard - Booking Mode";
        closeModal();
        searchRooms();
    } else { alert("Access Denied!"); }
}

function logout() {
    isMentor = false;
    document.getElementById('navButtons').innerHTML = `<button onclick="openMentorModal()" class="bg-white text-blue-800 px-4 py-2 rounded-lg font-bold text-sm">Mentor Login</button>`;
    document.getElementById('uiTitle').innerText = "Find Available Rooms";
    searchRooms();
}

// Search & Logic
function searchRooms() {
    const day = document.getElementById('daySelect').value;
    const selectedTimes = Array.from(document.querySelectorAll('.p-check:checked')).map(c => c.value);
    const resultsDiv = document.getElementById('roomResults');
    resultsDiv.innerHTML = "";

    if (selectedTimes.length === 0) return alert("Select at least one slot!");

    const available = roomData.map(r => {
        if (r.day.toLowerCase() !== day.toLowerCase()) return null;
        const matched = selectedTimes.filter(time => r.slots.includes(time));
        if (matched.length > 0) return { ...r, matched };
        return null;
    }).filter(Boolean);

    available.forEach(r => {
        const isCurrentlyLive = liveBookings.find(b => b.room === r.room);
        resultsDiv.innerHTML += `
            <div onclick="${isMentor ? `openBooking('${r.room}')` : ''}" class="bg-white p-6 rounded-3xl shadow-lg border-2 border-transparent hover:border-blue-500 transition-all cursor-pointer relative overflow-hidden group">
                ${isCurrentlyLive ? `<div class="absolute top-0 right-0 bg-red-600 text-white text-[9px] px-3 py-1 font-bold">BUSY</div>` : ''}
                <h3 class="text-2xl font-black text-gray-800">${r.room}</h3>
                <p class="text-[10px] text-blue-600 font-bold mt-2">MATCHED: ${r.matched.length} SLOTS</p>
                <p class="text-[9px] text-gray-400 mt-1 italic">${r.matched.join(', ')}</p>
                ${isMentor ? `<div class="mt-4 bg-blue-50 text-blue-600 text-center py-2 rounded-xl text-[10px] font-bold group-hover:bg-blue-600 group-hover:text-white transition-all">CLICK TO BOOK</div>` : ''}
            </div>`;
    });
}

// Booking System
function openBooking(roomName) {
    currentBookingRoom = roomData.find(r => r.room === roomName && r.day === document.getElementById('daySelect').value);
    document.getElementById('bookRoomTitle').innerText = roomName;
    const slotList = document.getElementById('bookSlotList');
    slotList.innerHTML = "";
    
    currentBookingRoom.slots.forEach(s => {
        slotList.innerHTML += `
            <label class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
                <input type="checkbox" value="${s}" class="book-check w-5 h-5"> <span>${s}</span>
            </label>`;
    });
    
    document.getElementById('bookingModal').classList.remove('hidden');
}

function setWing(w) {
    selectedWing = w;
    document.querySelectorAll('.wing-btn').forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white', 'border-blue-900');
        if(b.innerText === w) b.classList.add('bg-blue-600', 'text-white', 'border-blue-900');
    });
}

function submitBooking() {
    const checkedSlots = Array.from(document.querySelectorAll('.book-check:checked')).map(c => c.value);
    if(!selectedWing || checkedSlots.length === 0) return alert("Select Wing and at least one Slot!");

    checkedSlots.forEach(slot => {
        const endTimeStr = slot.split('-')[1].trim(); // e.g., "08:50 AM"
        liveBookings.push({
            room: currentBookingRoom.room,
            wing: selectedWing,
            slot: slot,
            endTime: endTimeStr,
            day: currentBookingRoom.day
        });
    });

    saveToStorage();
    alert("Booking Submitted!");
    closeBooking();
    logout(); // Automatic exit mentor mode
    updateLiveDashboard();
}

function updateLiveDashboard() {
    const now = new Date();
    const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const currentDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];

    // Auto-clear logic: Time over hole ba din shesh hole muche jabe
    liveBookings = liveBookings.filter(b => {
        const isSameDay = b.day === currentDay;
        const isTimeLeft = compareTimes(b.endTime, currentTime);
        return isSameDay && isTimeLeft;
    });

    const liveDiv = document.getElementById('liveDashboard');
    const liveList = document.getElementById('liveList');
    liveList.innerHTML = "";

    if (liveBookings.length > 0) {
        liveDiv.classList.remove('hidden');
        liveBookings.forEach(b => {
            liveList.innerHTML += `
                <div class="flex justify-between items-center bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
                    <span><b class="text-red-700">${b.room}</b> | <span class="bg-red-600 text-white px-2 py-0.5 rounded text-[10px]">${b.wing}</span></span>
                    <span class="text-[11px] font-bold text-red-500">Till ${b.endTime}</span>
                </div>`;
        });
    } else {
        liveDiv.classList.add('hidden');
    }
    saveToStorage();
}

function compareTimes(endTime, nowTime) {
    const parse = (t) => {
        const [time, modifier] = t.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
        return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
    };
    return parse(endTime) > parse(nowTime);
}

// Storage helpers
function saveToStorage() { localStorage.setItem('ratul_bookings', JSON.stringify(liveBookings)); }
function loadFromStorage() {
    const saved = localStorage.getItem('ratul_bookings');
    if(saved) liveBookings = JSON.parse(saved);
    updateLiveDashboard();
}

// Modals
function openMentorModal() { document.getElementById('mentorModal').classList.remove('hidden'); }
function closeModal() { document.getElementById('mentorModal').classList.add('hidden'); }
function closeBooking() { document.getElementById('bookingModal').classList.add('hidden'); selectedWing = ""; }

setInterval(updateLiveDashboard, 30000); // 30 sec por por check korbe time sesh kina
init();