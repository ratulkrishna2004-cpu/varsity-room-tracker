const periods = [
    "08:00 AM-08:50 AM", "08:50 AM-09:40 AM", "09:40 AM-10:30 AM",
    "10:30 AM-11:20 AM", "11:20 AM-12:10 PM", "12:10 PM-01:00 PM",
    "01:00 PM-01:50 PM", "01:50 PM-02:40 PM", "02:40 PM-03:30 PM",
    "03:30 PM-04:20 PM", "04:20 PM-05:10 PM", "05:10 PM-06:00 PM"
];

const mentorCodes = ["RATUL2026"]; 
let isMentor = false;
let roomData = [];

// 1. Time Slot UI banano (Eita thikmoto call kora hoyeche ekhon)
function setupUI() {
    const grid = document.getElementById('periodGrid');
    grid.innerHTML = ""; // Clear existing
    periods.forEach(p => {
        grid.innerHTML += `
            <label class="border p-2 rounded flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-blue-50 transition">
                <input type="checkbox" value="${p}" class="p-check"> ${p}
            </label>`;
    });
}

// 2. CSV Load
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
    } catch (e) { console.error("CSV file error!"); }
}

// 3. Relaxed Search Logic (Joto milbe toto show korbe)
function searchRooms() {
    const selectedDay = document.getElementById('daySelect').value;
    const selectedTimes = Array.from(document.querySelectorAll('.p-check:checked')).map(c => c.value);
    const resultsDiv = document.getElementById('roomResults');
    resultsDiv.innerHTML = "";

    if (selectedTimes.length === 0) return alert("Please select at least one time slot!");

    const available = roomData.map(r => {
        if (r.day.toLowerCase() !== selectedDay.toLowerCase()) return null;
        
        // Match kora time gulo alada kora
        const matchedSlots = selectedTimes.filter(time => r.slots.includes(time));
        
        if (matchedSlots.length > 0) {
            return { ...r, matchedSlots };
        }
        return null;
    }).filter(Boolean);

    if (available.length === 0) {
        resultsDiv.innerHTML = `<p class="col-span-full text-center text-red-500 py-10">No rooms found for ${selectedDay}.</p>`;
        return;
    }

    available.forEach(r => {
        resultsDiv.innerHTML += `
            <div class="bg-white p-5 rounded-xl shadow-md border-l-8 border-green-500">
                <h3 class="text-xl font-bold text-gray-800">${r.room}</h3>
                <p class="text-[11px] text-blue-600 mt-2 font-bold uppercase">Matched Slots (${r.matchedSlots.length}):</p>
                <div class="text-[10px] text-gray-600 italic bg-gray-50 p-2 mt-1 rounded border">
                    ${r.matchedSlots.join('<br>')}
                </div>
            </div>`;
    });
}

// Mentor login simple functions
function openMentorModal() { document.getElementById('mentorModal').classList.remove('hidden'); }
function closeModal() { document.getElementById('mentorModal').classList.add('hidden'); }
function loginMentor() {
    if (mentorCodes.includes(document.getElementById('mCodeInput').value)) {
        isMentor = true; alert("Mentor Mode ON!"); closeModal(); searchRooms();
    } else { alert("Wrong Code!"); }
}

// Run on Load
setupUI();
loadCSV();