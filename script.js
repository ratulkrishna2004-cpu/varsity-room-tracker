function searchRooms() {
    const selectedDay = document.getElementById('daySelect').value;
    const selectedTimes = Array.from(document.querySelectorAll('.p-check:checked')).map(c => c.value);
    const resultsDiv = document.getElementById('roomResults');
    resultsDiv.innerHTML = "";

    if (selectedTimes.length === 0) return alert("Please select at least one time slot!");

    // Main Logic: Room-er free slots er sathe selected slots-er mil khujbe
    const available = roomData.map(r => {
        // Diner mil check kora
        if (r.day.toLowerCase() !== selectedDay.toLowerCase()) return null;

        // Intersection (Koyta time milse seta khuje ber kora)
        const matchedSlots = selectedTimes.filter(time => r.slots.includes(time));

        // Jodi minimum 1 ta mile, tobei return korbe
        if (matchedSlots.length > 0) {
            return { ...r, matchedSlots };
        }
        return null;
    }).filter(Boolean); // Null data gulo muche fela

    if (available.length === 0) {
        resultsDiv.innerHTML = `<p class="col-span-full text-center text-red-500 py-10 bg-white rounded-lg shadow">No rooms found for ${selectedDay} in any of these slots.</p>`;
        return;
    }

    // Result Show kora
    available.forEach(r => {
        resultsDiv.innerHTML += `
            <div class="bg-white p-5 rounded-xl shadow-md border-l-8 border-green-500">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800">${r.room}</h3>
                        <p class="text-[11px] text-blue-600 mt-2 font-semibold">Matched (${r.matchedSlots.length}):</p>
                        <p class="text-[10px] text-gray-600 italic leading-tight">${r.matchedSlots.join('<br>')}</p>
                    </div>
                    <span class="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase">Found</span>
                </div>
                ${isMentor ? `<button onclick="startLive('${r.room}', '${r.matchedSlots[r.matchedSlots.length-1]}')" class="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-bold shadow-sm">Start Bootcamp</button>` : ''}
            </div>`;
    });
}