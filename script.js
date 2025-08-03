
document.getElementById("upload").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const csvData = event.target.result;
    const lines = csvData.split("\n");
    const cardNames = lines.map(line => line.split(",")[0].trim()).filter(Boolean);

    fetchCardData(cardNames);
  };
  reader.readAsText(file);
});

function fetchCardData(cardNames) {
  const batched = [];
  while (cardNames.length) {
    const batch = cardNames.splice(0, 75);
    batched.push(batch);
  }

  batched.forEach(batch => {
    const body = {
      identifiers: batch.map(name => ({ name }))
    };

    fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    .then(res => res.json())
    .then(data => displayCards(data.data));
  });
}

function displayCards(cards) {
  const container = document.getElementById("results");
  container.innerHTML = "";
  cards.forEach(card => {
    const img = document.createElement("img");
    img.src = card.image_uris?.normal || "";
    img.alt = card.name;
    container.appendChild(img);
  });
}
