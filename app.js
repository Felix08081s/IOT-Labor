console.log("app.js geladen");
// einzelner Kommentar

/*
Mehrzeilen Kommentar
*/



const rooms = [
    { name: "Wohnzimmer", temp: 22, humidity: 45 },
    { name: "Schlafzimmer", temp: 19, humidity: 50 },
    { name: "Bad", temp: 21, humidity: 60 }
];

const dashboard = document.getElementById("dashboard");

rooms.forEach(room => {
    const card = document.createElement("div");
    card.className = "room-card";
    card.innerHTML = `
        <h2>${room.name}</h2>
        <p class="temp">${room.temp}°C</p>
        <p class="humidity">${room.humidity}%</p>
    `;
    
    card.addEventListener("click", () => {
        window.location.href =
            `room.html?room=${encodeURIComponent(room.name)}&temp=${room.temp}&hum=${room.humidity}`;
    });

    dashboard.appendChild(card);
});
