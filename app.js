const spots = [
  {id: 1, location: "123 Main St", pricePerHour: 0.05},
  {id: 2, location: "456 Oak Ave", pricePerHour: 0.03}
];

function renderSpots() {
  const container = document.getElementById('spots');
  container.innerHTML = '';
  spots.forEach(spot => {
    const div = document.createElement('div');
    div.className = 'spot';
    div.innerHTML = \`
      <p><strong>Location:</strong> \${spot.location}</p>
      <p><strong>Price:</strong> \${spot.pricePerHour} KAS/hour</p>
      <input id="hours-\${spot.id}" type="number" min="1" value="1">
      <button onclick="pay(\${spot.id})">Pay & Reserve</button>
    \`;
    container.appendChild(div);
  });
}

async function pay(spotId) {
  const spot = spots.find(s => s.id === spotId);
  const hours = parseInt(document.getElementById(\`hours-\${spotId}\`).value);
  const total = spot.pricePerHour * hours;
  // TODO: Integrate Kaspa wallet SDK here
  alert(\`You will be charged \${total} KAS for \${hours} hour(s) at \${spot.location}.\`);
}

window.onload = renderSpots;