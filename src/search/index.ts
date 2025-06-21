function onSearch(): void {}

const query = document.querySelector('input[name="query"]') as HTMLInputElement;
if (!query) {
 console.error("Search input not found");
}

query.addEventListener("input", (event) => {
 const searchText = (event.target as HTMLInputElement).value;
 if (!searchText) {
  console.error("No search text provided");
  return;
 }

 const httpApiUrl = "https://geocode-maps.yandex.ru/v1";
 const queryString = new URLSearchParams({
  apikey: "a28b0400-4c74-4bfe-b636-3884070c0f2e",
  geocode: searchText, // Используем переменную searchText из обработчика события
  format: "json",
  lang: "uz_UZ",
  bbox: "55.0,37.0~73.5,46.5", // Регион Узбекистан

  /* другие параметры HTTP API */
 }).toString();
 const fullUrl = `${httpApiUrl}?${queryString}`;
 fetchHttpApi(fullUrl)
  .then((data) => {
   console.log("API Response:", data);
  })
  .catch((error) => {
   console.error("Error fetching API:", error);
  });
 // Implement search logic here
});

// Получить ответ от HTTP API

async function fetchHttpApi(fullUrl) {
 const response = await fetch(fullUrl);
 if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`);
 }
 const data = await response.json();
 return data;
}
