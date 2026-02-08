/******** CONFIG ********/
const SHEET_URL = "TON_URL_WEB_APP"; 
const START_HOUR = 9;
const END_HOUR = 18;
const STEP = 15;
const SERVICE = 25;
const BUFFER = 70;
const TOTAL = SERVICE + BUFFER;
const DAYS_TO_SHOW = 5; // aujourd’hui + 4 jours
const PIXELS_PER_15 = 40;

/******** STATE ********/
let bookings = [];
let days = [];
let activeDayIndex = 0;
let selected = null;

/******** UTILS ********/
const pad = n => n.toString().padStart(2, "0");
const time = (h,m) => `${pad(h)}:${pad(m)}`;
function isoDate(d) { return d.toISOString().split("T")[0]; }
function formatDay(d) { 
    return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }); 
}
function minutesToPx(h,m) { 
    return ((h - START_HOUR) * 60 + m) / STEP * PIXELS_PER_15; 
}

function slotsToBlock(h,m) {
    const out = [];
    let total = 0;
    let currH = h;
    let currM = m;
    while (total < TOTAL) {
        out.push(time(currH,currM));
        currM += STEP;
        if (currM >= 60) {
            currM = 0;
            currH++;
        }
        total += STEP;
    }
    return out;
}

/******** LOAD BOOKINGS ********/
async function loadBookings() {
    try {
        const res = await fetch(SHEET_URL);
        if (res.ok) {
            bookings = await res.json();
        }
    } catch (e) {
        console.error("Erreur chargement bookings:", e);
        bookings = [];
    }
}

/******** DAYS GENERATION ********/
function generateDays() {
    days = [];
    for (let i = 0; i < DAYS_TO_SHOW; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        days.push(d);
    }
}

/******** RENDER ********/
function render() {
    renderDays();
    renderHours();
    renderColumns();
}

/* Days header */
function renderDays() {
    const el = document.getElementById("days");
    el.innerHTML = "";
    days.forEach((d, i) => {
        const div = document.createElement("div");
        div.className = "day" + (i === activeDayIndex ? " active" : "");
        div.textContent = formatDay(d);
        div.onclick = () => {
            activeDayIndex = i;
            selected = null;
            document.getElementById("validateBtn").disabled = true;
            document.getElementById("selectedInfo").textContent = "Aucun créneau sélectionné";
            render();
        };
        el.appendChild(div);
    });
}

/* Hours column */
function renderHours() {
    const el = document.getElementById("hours");
    el.innerHTML = "";
    for (let h = START_HOUR; h < END_HOUR; h++) {
        const div = document.createElement("div");
        div.textContent = `${h}:00`;
        el.appendChild(div);
    }
}

/* Columns */
function renderColumns() {
    const el = document.getElementById("columns");
    el.innerHTML = "";
    
    const activeDay = days[activeDayIndex];
    const col = document.createElement("div");
    col.className = "day-column active";
    
    // Créer une grille cliquable pour les slots
    for (let h = START_HOUR; h < END_HOUR; h++) {
        for (let m = 0; m < 60; m += STEP) {
            const t = time(h, m);
            const blocked = bookings.some(b => b.date === isoDate(activeDay) && b.slots.includes(t));
            
            if (!blocked) {
                const clickableArea = document.createElement("div");
                clickableArea.style.position = "absolute";
                clickableArea.style.top = minutesToPx(h, m) + "px";
                clickableArea.style.height = PIXELS_PER_15 + "px";
                clickableArea.style.width = "100%";
                clickableArea.onclick = () => selectSlot(activeDay, h, m, col);
                col.appendChild(clickableArea);
            }
        }
    }

    if (selected && isoDate(selected.day) === isoDate(activeDay)) {
        drawSelectedSlot(col, selected.h, selected.m);
    }

    el.appendChild(col);
}

function drawSelectedSlot(col, h, m) {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.style.top = minutesToPx(h, m) + "px";
    slot.style.height = (TOTAL / STEP) * PIXELS_PER_15 + "px";
    slot.textContent = time(h, m);
    col.appendChild(slot);
}

/******** SLOT SELECTION ********/
function selectSlot(day, h, m, col) {
    selected = { day, h, m };
    document.getElementById("selectedInfo").textContent = `${isoDate(day)} — ${time(h, m)}`;
    document.getElementById("validateBtn").disabled = false;
    render();
}

/******** VALIDATION ********/
document.getElementById("validateBtn").onclick = async () => {
    if (!selected) return;
    const btn = document.getElementById("validateBtn");
    btn.disabled = true;
    btn.textContent = "Envoi...";

    const slots = slotsToBlock(selected.h, selected.m);
    try {
        await fetch(SHEET_URL, {
            method: "POST",
            mode: 'no-cors', // Souvent nécessaire pour Google Apps Script
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                date: isoDate(selected.day),
                start_time: time(selected.h, selected.m),
                end_time: slots.at(-1),
                slots
            })
        });
        
        alert("Réservation envoyée !");
        await loadBookings();
        selected = null;
        document.getElementById("selectedInfo").textContent = "Réservation confirmée";
        render();
    } catch (e) {
        console.error("Erreur validation:", e);
        alert("Erreur lors de la réservation.");
    } finally {
        btn.textContent = "Valider la réservation";
    }
};

/******** INIT ********/
(async () => {
    generateDays();
    await loadBookings();
    render();
})();
