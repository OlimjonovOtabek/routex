// index.ts
// --- Импорты из внешних библиотек и ваших общих утилит ---
// Turf.js для гео-расчетов
import { along, booleanEqual, length, lineString, point } from "@turf/turf";
// Типы из Яндекс.Карт (через tsconfig.paths)
// Ваши общие утилиты и константы. Убедитесь, что пути правильные.
// (Предполагается, что эти файлы находятся рядом с index.ts или в src/common)
// Если common.ts находится в src/common, то путь будет '../common' относительно dist/index.js
// Если common.ts в корне, как index.ts, то "./common"
import { // Тип для ID анимации
angleFromCoordinate, animate, splitLineString, } from "../common"; // <-- Уточните путь к common.ts
import { MARKER_IMAGE_PATH, PASSED_ROUTE_STYLE, ROUTE_STYLE, } from "../variables"; // <-- Уточните путь к variables.ts
// --- Глобальные переменные состояния приложения ---
let mapInstance = null;
let brigadeMarker = null;
let routeLinePassed = null; // Пройденный маршрут
let routeLineRemaining = null; // Оставшийся маршрут
let currentBrigadeLocation = null; // Текущая локация бригады
let currentRoute = null; // Текущий маршрут
let animationFrameId = null; // ID текущей анимации
let pollingInterval = null; // ID интервала для polling'а
const POLLING_INTERVAL_MS = 10000; // Интервал запроса к бэкенду (10 секунд)
// --- Получение элементов DOM ---
const loadingMessage = document.getElementById("loading-message");
const activeTrackingPanel = document.getElementById("active-tracking-panel");
const finishedCallAlert = document.getElementById("finished-call-alert");
const brigadeNameSpan = document.getElementById("brigade-name");
const carNumberSpan = document.getElementById("car-number");
const patientAddressSpan = document.getElementById("patient-address");
const mapElement = document.getElementById("map");
// --- Вспомогательные функции ---
/**
 * Извлекает ID вызова из URL.
 */
function getCallIdFromUrl() {
    const params = window.location.search.split("=")[1];
    return params;
}
/**
 * Имитация получения токена (если ваш API требует)
 * @param assignmentId
 * @param createdAt
 */
async function getToken(assignmentId = "6fed6b78-47c6-4de9-b033-ad4b5d3da7a3", // Заменить на реальные данные
createdAt = "2025-06-19T12:26:59.155017+05:00" // Заменить на реальные данные
) {
    try {
        const response = await fetch(`https://103.init.uz/brigade-tracking-service/api/brigade-tracking/get-token?assignmentId=${assignmentId}&createdAt=${createdAt}`);
        if (!response.ok)
            throw new Error(`Ошибка получения токена: ${response.statusText}`);
        return await response.text();
    }
    catch (error) {
        console.error("Ошибка при получении токена:", error);
        loadingMessage.textContent =
            "Ошибка аутентификации. Пожалуйста, попробуйте позднее.";
        throw error; // Перебрасываем ошибку, чтобы остановить выполнение
    }
}
/**
 * Имитация получения данных о вызове и бригаде
 * Этот метод должен быть вашей основной точкой для получения всех данных о вызове.
 * @param callId ID вызова
 * @param token Токен для доступа к API (если нужен)
 */
async function fetchBrigadeTrackingData(callId, token) {
    try {
        // ВНИМАНИЕ: Это заглушка! Замените на ваш реальный эндпоинт и параметры.
        // Пример: `https://your-backend.com/api/v1/track/${callId}?token=${token}`
        const response = await fetch(`https://103.init.uz/brigade-tracking-service/api/brigade-tracking/assignments/oJTfJVA1qQl5YFKEWmgaeAHHKTXFmQVkFwHap7iuP-I.` // Это кажется эндпоинтом для 'assignments'
        // Вам, возможно, понадобится другой эндпоинт, который возвращает BrigadeTrackingData
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const assignmentData = await response.json(); // Получаем данные Assignment
        console.log("Получены Assignment:", assignmentData);
        // Дополнительный запрос для локации бригады, если он отдельный
        const brigadeLocationResponse = await fetch(`https://103.init.uz/brigade-tracking-service/api/brigade-tracking/brigade-location/${assignmentData.brigadeId}?token=${token}` // Используем brigadeId
        );
        if (!brigadeLocationResponse.ok) {
            throw new Error(`Ошибка получения локации бригады: ${brigadeLocationResponse.statusText}`);
        }
        const brigadeLocationData = await brigadeLocationResponse.json(); // Use anonymous type for immediate destructuring if needed
        console.log("Получена локация бригады:", brigadeLocationData);
        // Собираем данные в BrigadeTrackingData.
        // В реальном приложении бэкенд должен присылать все это одним запросом.
        // Маршрут здесь пока жестко задан, но должен приходить с бэкенда
        const mockRoute = [
            [
                assignmentData.brigadeLocation.longitude,
                assignmentData.brigadeLocation.latitude,
            ],
            [
                assignmentData.destinationLocation.longitude,
                assignmentData.destinationLocation.latitude,
            ], // Конец маршрута
            // В реальном API здесь будет полноценный массив точек маршрута
        ];
        // Имитируем статус
        let currentStatus = "enRoute";
        // Для демо: если бригада близко к пациенту, меняем статус на "arrived"
        const distanceToPatient = length(lineString([
            [brigadeLocationData.longitude, brigadeLocationData.latitude],
            [
                assignmentData.destinationLocation.longitude,
                assignmentData.destinationLocation.latitude,
            ],
        ]), { units: "meters" });
        if (distanceToPatient < 50) {
            // Менее 50 метров до пациента
            currentStatus = "arrived";
        }
        return {
            brigadeInfo: {
                name: assignmentData.nameRu,
                carNumber: assignmentData.brigadePlateNumber || "Неизвестен",
            },
            currentLocation: [
                brigadeLocationData.longitude,
                brigadeLocationData.latitude,
            ],
            routeCoordinates: mockRoute,
            status: currentStatus,
            patientLocation: [
                assignmentData.destinationLocation.longitude,
                assignmentData.destinationLocation.latitude,
            ],
            patientAddress: assignmentData.destinationFullAddressLine,
        };
    }
    catch (error) {
        console.error("Ошибка при получении данных отслеживания:", error);
        loadingMessage.textContent =
            "Ошибка загрузки данных. Пожалуйста, попробуйте позднее.";
        return null;
    }
}
/**
 * Анимирует маркер бригады к новой точке и обновляет маршрут.
 * @param fromCoords Начальные координаты маркера.
 * @param toCoords Конечные координаты маркера.
 * @param route Новые координаты всего маршрута.
 */
function animateBrigadeToNewLocation(fromCoords, toCoords, newRoute) {
    if (!mapInstance ||
        !brigadeMarker ||
        !routeLinePassed ||
        !routeLineRemaining) {
        console.warn("Карта или маркер не инициализированы для анимации.");
        return;
    }
    // Если уже есть анимация, отменяем ее
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId.getAnimationId()); // Уточняем тип для cancelAnimationFrame
    }
    const segment = lineString([fromCoords, toCoords]);
    const segmentLength = length(segment, { units: "meters" });
    let prevAnimatedCoords = fromCoords; // Для расчета угла поворота
    animationFrameId = animate((progress) => {
        // Вычисляем текущую позицию маркера на сегменте
        const currentCoordinates = along(segment, segmentLength * progress, {
            units: "meters",
        }).geometry.coordinates;
        // Обновляем позицию маркера
        brigadeMarker.update({ coordinates: currentCoordinates });
        // Обновляем угол поворота маркера
        if (prevAnimatedCoords &&
            !booleanEqual(point(prevAnimatedCoords), point(currentCoordinates))) {
            const angle = angleFromCoordinate(prevAnimatedCoords, currentCoordinates);
            const markerElement = document.getElementById("marker");
            if (markerElement) {
                markerElement.style.transform = `rotate(${angle}deg)`;
            }
        }
        prevAnimatedCoords = currentCoordinates; // Обновляем предыдущие для следующего кадра
        // Обновляем отрисовку маршрута
        // Сначала обновляем весь маршрут, затем разбиваем его на пройденный и оставшийся
        // Важно: здесь `newRoute` - это полный маршрут до пациента, а не только текущий сегмент движения бригады
        const [passedLineString, remainingLineString] = splitLineString(lineString(newRoute), // Используем весь новый маршрут
        currentCoordinates);
        routeLinePassed.update({ geometry: passedLineString });
        routeLineRemaining.update({ geometry: remainingLineString });
    });
}
/**
 * Обновляет UI данными бригады и положением на карте.
 * @param data Новые данные отслеживания.
 */
function updateUI(data) {
    brigadeNameSpan.textContent = data.brigadeInfo.name;
    carNumberSpan.textContent = data.brigadeInfo.carNumber || "Неизвестен";
    patientAddressSpan.textContent = data.patientAddress;
    // Если локация бригады изменилась, анимируем маркер
    if (currentBrigadeLocation &&
        !booleanEqual(point(currentBrigadeLocation), point(data.currentLocation))) {
        animateBrigadeToNewLocation(currentBrigadeLocation, data.currentLocation, data.routeCoordinates);
    }
    else if (!currentBrigadeLocation && mapInstance) {
        // Первая инициализация маркера, если еще не было анимации
        brigadeMarker.update({ coordinates: data.currentLocation });
        // Устанавливаем карту так, чтобы были видны бригада и пациент
        mapInstance.setLocation([data.patientLocation, data.currentLocation].concat(data.routeCoordinates || []));
    }
    // Обновляем текущую локацию для следующего интервала polling
    currentBrigadeLocation = data.currentLocation;
    currentRoute = data.routeCoordinates; // Сохраняем текущий маршрут
    // Маркер пациента (если нужно переместить или обновить)
    // mapInstance.YMapMarker.update({ coordinates: data.patientLocation });
}
/**
 * Обрабатывает изменение статуса вызова.
 * @param status Текущий статус вызова.
 */
function handleCallStatus(status) {
    if (status === "arrived" || status === "cancelled") {
        // Останавливаем polling
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        // Отменяем текущую анимацию, если она есть
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId.getAnimationId());
            animationFrameId = null;
        }
        // Скрываем панель отслеживания и карту
        activeTrackingPanel.style.display = "none";
        mapElement.style.display = "none";
        // Показываем сообщение о завершении вызова
        finishedCallAlert.style.display = "block";
    }
    else if (status === "enRoute") {
        loadingMessage.style.display = "none";
        activeTrackingPanel.style.display = "block";
        finishedCallAlert.style.display = "none";
    }
    else if (status === "pending") {
        loadingMessage.style.display = "block";
        activeTrackingPanel.style.display = "none";
        finishedCallAlert.style.display = "none";
    }
}
/**
 * Главная функция инициализации приложения.
 */
async function main() {
    debugger;
    const callId = getCallIdFromUrl();
    if (!callId) {
        loadingMessage.textContent =
            "Ошибка: Идентификатор вызова не указан в ссылке.";
        return;
    }
    handleCallStatus("pending"); // Начальный статус: ожидание
    // Убедитесь, что глобальный объект ymaps3 и его Promise 'ready' существуют
    if (!window.ymaps3 || !window.ymaps3.ready) {
        loadingMessage.textContent =
            "Ошибка: API Яндекс.Карт не загружен. Пожалуйста, обновите страницу.";
        console.error("Yandex Maps API global object not found or not ready.");
        return;
    }
    // Дожидаемся полной загрузки API Яндекс.Карт (top-level await)
    await window.ymaps3.ready;
    const ymaps3 = window.ymaps3; // Локальная ссылка на глобальный объект
    // Загружаем YMapDefaultMarker из @yandex/ymaps3-default-ui-theme
    const { YMapDefaultMarker } = await ymaps3.import("@yandex/ymaps3-default-ui-theme");
    // --- Инициализация карты (только один раз) ---
    mapInstance = new ymaps3.YMap(mapElement, {
        location: {
            center: [69.2401, 41.2995],
            zoom: 10,
        },
        showScaleInCopyrights: true,
    }, [
        new ymaps3.YMapDefaultSchemeLayer({}),
        new ymaps3.YMapDefaultFeaturesLayer({}),
    ]);
    window.map = mapInstance; // Сохраняем в глобальной переменной window.map
    // --- Инициализация элементов маршрута и маркеров ---
    routeLinePassed = new ymaps3.YMapFeature({
        geometry: { coordinates: [], type: "LineString" },
        style: PASSED_ROUTE_STYLE,
    });
    routeLineRemaining = new ymaps3.YMapFeature({
        geometry: { coordinates: [], type: "LineString" },
        style: ROUTE_STYLE,
    });
    mapInstance.addChild(routeLinePassed);
    mapInstance.addChild(routeLineRemaining);
    // Маркер бригады
    const markerElement = document.createElement("div");
    markerElement.classList.add("marker_container");
    const markerElementImg = document.createElement("img");
    markerElementImg.src = MARKER_IMAGE_PATH; // Путь к изображению машины
    markerElementImg.alt = "marker";
    markerElementImg.id = "marker";
    markerElement.appendChild(markerElementImg);
    brigadeMarker = new ymaps3.YMapMarker({
        coordinates: [0, 0],
        disableRoundCoordinates: true,
    }, markerElement);
    mapInstance.addChild(brigadeMarker);
    // --- Основная логика получения и обновления данных ---
    let TOKEN; // Токен, если используется
    try {
        // ВНИМАНИЕ: Замените ID на реальные, если токен зависит от assignmentId
        TOKEN = await getToken("6fed6b78-47c6-4de9-b033-ad4b5d3da7a3", "2025-06-19T12:26:59.155017+05:00");
    }
    catch (error) {
        console.error("Не удалось получить токен, прекращаем работу.");
        return;
    }
    // Первая загрузка данных
    const initialData = await fetchBrigadeTrackingData(callId, TOKEN);
    if (!initialData) {
        // Сообщение об ошибке уже установлено в fetchBrigadeTrackingData
        return;
    }
    handleCallStatus(initialData.status); // Обрабатываем начальный статус
    if (initialData.status === "enRoute") {
        // Инициализируем UI и карту первыми данными
        currentBrigadeLocation = initialData.currentLocation; // Устанавливаем начальную позицию бригады
        updateUI(initialData);
        // Устанавливаем карту так, чтобы были видны бригада и пациент
        mapInstance.setLocation([initialData.patientLocation, initialData.currentLocation].concat(initialData.routeCoordinates || []));
        // Запускаем polling для получения обновлений
        pollingInterval = window.setInterval(async () => {
            const updatedData = await fetchBrigadeTrackingData(callId, TOKEN);
            if (updatedData) {
                handleCallStatus(updatedData.status); // Обрабатываем статус
                if (updatedData.status === "enRoute") {
                    // Если статус "в пути", обновляем UI и инициируем анимацию
                    updateUI(updatedData);
                }
            }
        }, POLLING_INTERVAL_MS);
    }
}
document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOMContentLoaded");
});
function startApplication() {
    console.log("Лог: Попытка запуска приложения...");
    main();
}
// Проверяем, если DOM уже готов (interactive или complete)
if (document.readyState === "loading") {
    // Документ все еще загружается, ждем DOMContentLoaded
    console.log('Лог: document.readyState = "loading", ждем DOMContentLoaded...');
    document.addEventListener("DOMContentLoaded", startApplication);
}
else {
    // Документ уже интерактивен или полностью загружен, запускаем приложение немедленно
    console.log('Лог: document.readyState = "' +
        document.readyState +
        '", запускаем приложение немедленно...');
    startApplication();
}
