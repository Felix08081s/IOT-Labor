const params = new URLSearchParams(window.location.search);
const roomName = params.get("room");
const currentTemp = params.get("temp");
const currentHumidity = params.get("hum");

document.getElementById("room-name").textContent = roomName;
document.getElementById("current-temp").textContent = currentTemp;
document.getElementById("current-humidity").textContent = currentHumidity;

const slider = document.getElementById("temp-slider");
const targetTemp = document.getElementById("target-temp");

slider.value = currentTemp;
targetTemp.textContent = currentTemp;

slider.addEventListener("input", () => {
    targetTemp.textContent = slider.value;

    // später: REST oder MQTT
});
