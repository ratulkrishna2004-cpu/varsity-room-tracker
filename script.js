const periods = [
    "08:00 AM-08:50 AM", "08:50 AM-09:40 AM", "09:40 AM-10:30 AM",
    "10:30 AM-11:20 AM", "11:20 AM-12:10 PM", "12:10 PM-01:00 PM",
    "01:00 PM-01:50 PM", "01:50 PM-02:40 PM", "02:40 PM-03:30 PM",
    "03:30 PM-04:20 PM", "04:20 PM-05:10 PM", "05:10 PM-06:00 PM"
];

const mentorCodes = ["RATUL2026", "MENTOR123"]; 
let isMentor = false;
let roomData = [];
let activeLive = [];

// 1. Load CSV and Auto-fill Period Grid
async function init() {
    const grid = document.getElementById('periodGrid');
    periods.forEach(p => {
        grid.innerHTML += `
            <label class="border p-2 rounded flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-blue-50 transition">
                <input type="checkbox" value="${p}" class="p-check"> ${p}
            </label>`;
    });
    await loadCSV();
}

async function loadCSV() {
    try {
        const response = await fetch('routine.csv');
        const text = await response.text();
        const rows = text.split('\n').filter(r => r.trim() !== "");
        roomData = rows.slice(1).map(row => {
            const parts = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            return {
                day: parts[0].trim(),
                room: parts[1].replace(/"/g, "").trim(),
                slots: parts[2].replace(/"/g, "").split(',').map(s => s.trim())
            };
        });
    } catch (e) { console.error("CSV file not found!"); }
}

// 2. Search Logic
function searchRooms() {
    const selectedDay = document.getElementById('daySelect').value;
    const selectedTimes = Array.from(document.querySelectorAll('.p-check:checked')).map(c => c.value);
    const resultsDiv = document.getElementById('roomResults');
    resultsDiv.innerHTML = "";

    if (selectedTimes.length === 0) return alert("Please select at least one time slot!");

    // Filter by Day and Selected Time Slots
    const available = roomData.filter(r => {
        const dayMatch = r.day.toLowerCase() === selectedDay.toLowerCase();
        const timeMatch = selectedTimes.every(time => r.slots.includes(time));
        return dayMatch && timeMatch;
    });

    if (available.length === 0) {
        resultsDiv.innerHTML = `<p class="col-span-full text-center text-red-500 py-10 bg-white rounded-lg shadow">No rooms found for ${selectedDay} in these slots.</p>`;
        return;
    }

    available.forEach(r => {
        resultsDiv.innerHTML += `
            <div class="bg-white p-5 rounded-xl shadow-md border-l-8 border-green-500">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800">${r.room}</h3>
                        <p class="text-[10px] text-gray-500 mt-1 italic">Matched Slots: ${selectedTimes.join(', ')}</p>
                    </div>
                    <span class="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold">AVAILABLE</span>
                </div>
                ${isMentor ? `<button onclick="startLive('${r.room}', '${selectedTimes[selectedTimes.length-1]}')" class="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-bold">Start Bootcamp</button>` : ''}
            </div>`;
    });
}

// 3. Mentor Functions
function openMentorModal() { document.getElementById('mentorModal').classList.remove('hidden'); }
function closeModal() { document.getElementById('mentorModal').classList.add('hidden'); }
function loginMentor() {
    const val = document.getElementById('mCodeInput').value;
    if (mentorCodes.includes(val)) {
        isMentor = true;
        alert("Mentor Mode Activated!");
        closeModal();
    } else { alert("Wrong Code!"); }
}

function startLive(room, endTime) {
    const type = prompt("Enter Class Type (e.g., W1, Bootcamp):");
    if (!type) return;
    activeLive.push({ room, type, endTime });
    updateLiveUI();
}

function updateLiveUI() {
    const sec = document.getElementById('liveSection');
    const list = document.getElementById('liveList');
    list.innerHTML = "";
    if (activeLive.length) sec.classList.remove('hidden');
    activeLive.forEach(c => {
        list.innerHTML += `
            <div class="flex justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                <span><b>${c.room}</b> - ${c.type}</span>
                <span class="text-red-600 font-bold">Ends at ${c.endTime}</span>
            </div>`;
    });
}

// Check every minute to auto-clear live classes
setInterval(() => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    activeLive = activeLive.filter(c => c.endTime > now);
    updateLiveUI();
}, 60000);

init();