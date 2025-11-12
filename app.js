document.addEventListener("DOMContentLoaded", () => {
    const sliders = document.querySelectorAll(".slider");
    const temps = document.querySelectorAll(".temp");

    sliders.forEach((slider, index) => {
        slider.addEventListener("input", () => {
            temps[index].textContent = slider.value + "°C";
            // Später: Hier kannst du einen API-Call einbauen, um die Temperatur an das IoT-System zu senden
        });
    });
});