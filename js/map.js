let map;
let marker;

function initMap(lat, lng, onLocationChanged) {
  if (!map) {
    map = L.map('map').setView([lat, lng], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    marker = L.marker([lat, lng], { draggable: true }).addTo(map);

    marker.on('dragend', function (e) {
      const position = marker.getLatLng();
      onLocationChanged(position.lat, position.lng);
    });
  } else {
    map.setView([lat, lng], 10);
    marker.setLatLng([lat, lng]);
  }
}

function updateMapLocation(lat, lng) {
  if (map && marker) {
    map.setView([lat, lng], 10);
    marker.setLatLng([lat, lng]);
  }
}

window.mapModule = {
  initMap,
  updateMapLocation
};
