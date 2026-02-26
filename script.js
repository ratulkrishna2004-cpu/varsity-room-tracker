const periods = [
    "08:00 AM-08:50 AM", "08:50 AM-09:40 AM", "09:40 AM-10:30 AM",
    "10:30 AM-11:20 AM", "11:20 AM-12:10 PM", "12:10 PM-01:00 PM",
    "01:00 PM-01:50 PM", "01:50 PM-02:40 PM", "02:40 PM-03:30 PM",
    "03:30 PM-04:20 PM", "04:20 PM-05:10 PM", "05:10 PM-06:00 PM"
];

// MENTOR CODES: Add as many codes as you want here
const mentorCodes = ["RATUL2026", "MENTOR_W1", "BOOTCAMP_SEC_A", "CLUB_LEADER"];

let isMentor = false;
let roomData = [];
let liveClasses = [];

// 1. Create Checkboxes
const grid = document.getElementById('periodGrid');
periods.forEach(p => {
    grid.innerHTML += `
        <label class="flex items-center gap-2 p-2 border rounded text-xs cursor-pointer hover:bg-gray-100">
            <input type="checkbox" value="${p}" class="p-check"> ${p}
        </label>`;
});

// 2. Load Routine from CSV
async function loadRoutine() {
    try {
        const res = await fetch('routine.csv');
        const text = await res.text();
        const rows = text.split('\n').filter(r => r.trim() !== "");
        roomData = rows.slice(1).map(row => {
            const parts = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            return {
                room: parts[0].replace(/"/g, "").trim(),
                slots: parts[1].replace(/"/g, "").split(',').map(s => s.trim())
            };
        });
    } catch (e) { console.error("CSV not found!"); }
}

// 3. Mentor Login
function verifyMentor() {
    const val = document.getElementById('mCode').value;
    if (mentorCodes.includes(val)) {
        isMentor = true;
        alert("Mentor Mode Activated!");
        document.getElementById('mModal').classList.add('hidden');
    } else { alert("Invalid Code!"); }
}

// 4. Search Room
function searchRooms() {
    const selected = Array.from(document.querySelectorAll('.p-check:checked')).map(c => c.value);
    const resDiv = document.getElementById('results');
    resDiv.innerHTML = "";

    if(!selected.length) return alert("Select at least one period!");

    const available = roomData.filter(r => selected.every(s => r.slots.includes(s)));

    available.forEach(r => {
        resDiv.innerHTML += `
            <div class="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                <p class="font-bold text-lg">${r.room}</p>
                <p class="text-xs text-green-600">Free in selected slots</p>
                ${isMentor ? `<button onclick="startLive('${r.room}', '${selected[selected.length-1]}')" class="mt-2 bg-red-600 text-white px-3 py-1 rounded text-xs">Start Live Class</button>` : ''}
            </div>`;
    });
}

// 5. Live Class Management
function startLive(room, endTime) {
    const type = prompt("Enter Class Type (W1, W2, etc):");
    if(!type) return;
    liveClasses.push({ room, type, endTime });
    updateLiveUI();
}

function updateLiveUI() {
    const sec = document.getElementById('liveSection');
    const list = document.getElementById('liveList');
    list.innerHTML = "";
    if(liveClasses.length) sec.classList.remove('hidden');
    
    liveClasses.forEach(c => {
        list.innerHTML += `
            <div class="flex justify-between items-center p-3 bg-red-50 rounded border border-red-200">
                <span><b>${c.room}</b> (${c.type})</span>
                <span class="text-red-600 font-bold">Ends: ${c.endTime}</span>
            </div>`;
    });
}

// Auto-Clear logic every 1 minute
setInterval(() => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    liveClasses = liveClasses.filter(c => c.endTime > now);
    updateLiveUI();
}, 60000);

loadRoutine();