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

// 1. Eikhane Code er shathe Name map kora ache
const mentors = [
    { name: "Ratul Krishna Mojumder", code: "RATUL2026" },
    { name: "AUST Admin", code: "AUSTADMIN" }
];

let currentMentor = null, roomData = [], liveBookings = [], currentRoom = null;

function init() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = days[new Date().getDay()];
    const daySelect = document.getElementById('daySelect');

    // Weekend Auto-check
    if (today === "Friday" || today === "Saturday") {
        document.getElementById('roomResults').innerHTML = `<p class="col-span-full text-center py-20 text-xl font-bold text-white/30 uppercase tracking-widest italic">🏠 Weekend - Varsity is Closed</p>`;
    } else {
        daySelect.value = today;
    }

    const grid = document.getElementById('periodGrid');
    if (grid) {
        grid.innerHTML = "";
        periods.forEach(p => {
            grid.innerHTML += `<label class="bg-white/80 p-2 rounded-lg flex items-center gap-1 cursor-pointer border border-transparent hover:border-indigo-400 transition text-[8px] text-indigo-950 font-black"><input type="checkbox" value="${p}" class="p-check"> ${p}</label>`;
        });
    }
    loadCSV();
    syncFirebase();
    setInterval(autoCleanup, 60000); // 1 min por por auto check korbe
}

// 2. Auto Cleanup Logic (Time sesh hole auto delete)
function autoCleanup() {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    liveBookings.forEach(b => {
        const [time, modifier] = b.endTime.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        const expiryTime = hours * 100 + minutes;
        if (currentTime >= expiryTime) {
            remove(ref(db, 'bookings/' + b.firebaseKey));
        }
    });
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
        if(currentMentor) refreshMentorPanel();
        searchRooms(); 
    });
}

// 3. Login Logic: Code dile Name detect korbe
window.loginMentor = function() {
    const inputCode = document.getElementById('mCodeInput').value;
    const found = mentors.find(m => m.code === inputCode);
    
    if (found) {
        currentMentor = found;
        // Navbar e name show korbe
        document.getElementById('authArea').innerHTML = `<span class="bg-green-600 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase shadow-lg animate-bounce">Hello, ${found.name.split(' ')[0]}</span>`;
        document.getElementById('mentorDashboard').classList.remove('hidden');
        // Dashboard title update
        document.querySelector('#mentorDashboard h2').innerText = `DASHBOARD: ${found.name}`;
        closeModal('mentorModal');
        searchRooms();
    } else { alert("Invalid Mentor Code!"); }
};

window.logout = function() {
    currentMentor = null;
    document.getElementById('authArea').innerHTML = `<button onclick="openModal('mentorModal')" class="bg-white text-indigo-950 px-3 py-2 rounded-lg text-[10px] font-black uppercase">Mentor Login</button>`;
    document.getElementById('mentorDashboard').classList.add('hidden');
    searchRooms();
};

window.searchRooms = function() {
    const day = document.getElementById('daySelect').value;
    const selected = Array.from(document.querySelectorAll('.p-check:checked')).map(c => c.value);
    const resultsDiv = document.getElementById('roomResults');
    if(!resultsDiv) return;
    if (selected.length === 0) { resultsDiv.innerHTML = ""; return; }

    const available = roomData.map(r => {
        if (r.day.toLowerCase() !== day.toLowerCase()) return null;
        const matched = selected.filter(time => r.slots.includes(time));
        return matched.length > 0 ? { ...r, matched } : null;
    }).filter(Boolean);

    resultsDiv.innerHTML = "";
    available.forEach(r => {
        const isBusy = liveBookings.some(b => b.room === r.room);
        const clickAction = currentMentor ? `onclick="openBooking('${r.room.replace(/'/g, "\\'")}')"` : "";
        
        resultsDiv.innerHTML += `
            <div ${clickAction} class="bg-white/95 p-6 rounded-[32px] shadow-2xl transition-all ${currentMentor ? 'cursor-pointer hover:scale-105 border-2 border-indigo-400' : ''} relative overflow-hidden">
                ${isBusy ? `<span class="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black px-3 py-1 rounded-bl-xl animate-pulse">LIVE NOW</span>` : ''}
                <h3 class="text-2xl font-black text-indigo-950 mb-3">${r.room}</h3>
                <div class="space-y-1">
                    ${r.matched.map(m => `<p class="text-[11px] text-indigo-950 font-bold bg-indigo-50 px-2 py-1 rounded-md inline-block mr-1 mb-1 italic"> ${m}</p>`).join('')}
                </div>
                ${currentMentor ? `<div class="mt-4 bg-indigo-600 text-white text-[10px] font-black text-center py-2 rounded-xl uppercase tracking-tighter">Book as ${currentMentor.name.split(' ')[0]}</div>` : ''}
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

// 4. Booking submit hobar somoy Mentor Name-o save hobe
window.submitBooking = function() {
    const wing = document.getElementById('wingSelect').value;
    const selected = Array.from(document.querySelectorAll('.book-check:checked')).map(c => c.value);
    if (!wing || selected.length === 0) return alert("Select Wing and Slots!");

    selected.forEach(s => {
        const id = Date.now() + "_" + Math.floor(Math.random() * 1000);
        set(ref(db, 'bookings/' + id), { 
            room: currentRoom.room, 
            wing, 
            slot: s, 
            endTime: s.split('-')[1].trim(), 
            day: currentRoom.day,
            mentor: currentMentor.name // Mentor-er puru name save hobe
        });
    });
    alert(`Successfully booked by ${currentMentor.name}`);
    closeModal('bookingModal');
};

window.cancelBooking = (fKey) => { remove(ref(db, 'bookings/' + fKey)); };

function refreshMentorPanel() {
    const list = document.getElementById('myBookingsList');
    if(!list) return;
    const myItems = liveBookings.filter(b => b.mentor === currentMentor.name);
    list.innerHTML = myItems.length > 0 ? "" : `<p class="text-[10px] text-center py-8 text-white/30 font-bold uppercase tracking-widest">No active classes for you</p>`;
    myItems.forEach(b => {
        list.innerHTML += `<div class="bg-white/10 p-4 rounded-2xl flex justify-between items-center border border-white/10 shadow-xl"><div class="text-[11px] font-black"><span class="text-indigo-400">${b.room}</span><br><span class="text-white/60 font-normal">${b.slot}</span></div><button onclick="cancelBooking('${b.firebaseKey}')" class="bg-red-500/20 text-red-400 border border-red-500/50 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-red-500 hover:text-white transition-all">CANCEL</button></div>`;
    });
}

// 5. Sidebar-e shobai Mentor-er name dekhte parbe
function updateLiveUI() {
    const list = document.getElementById('sidebarLiveList');
    if(!list) return;
    list.innerHTML = liveBookings.length > 0 ? "" : `<div class="text-center py-20"><p class="text-white/20 font-black uppercase text-[10px] tracking-widest italic">No Live Classes</p></div>`;
    
    liveBookings.forEach(b => {
        list.innerHTML += `
            <div class="p-5 bg-white/5 rounded-[24px] border border-indigo-500/20 shadow-inner group">
                <div class="flex justify-between items-start mb-2">
                    <p class="font-black text-indigo-400 text-lg">${b.room}</p>
                    <span class="text-[8px] bg-white/10 text-white/40 px-2 py-0.5 rounded uppercase font-bold">${b.day}</span>
                </div>
                <p class="text-[10px] text-white/80 font-bold mb-3 italic">Time: ${b.slot}</p>
                <div class="flex justify-between items-center pt-3 border-t border-white/5">
                    <span class="text-[9px] bg-indigo-500 text-white px-2 py-0.5 rounded font-black uppercase">${b.wing}</span>
                    <span class="text-[9px] text-green-400 font-black uppercase tracking-tighter">By: ${b.mentor}</span>
                </div>
            </div>`;
    });
}

window.toggleLiveSidebar = () => document.getElementById('liveSidebar').classList.toggle('translate-x-full');
window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

init();