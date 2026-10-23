-- Örnek Araç Verileri
INSERT INTO vehicles (licensePlate, model, color, capacity, assignedUserId, isActive, createdAt, updatedAt) VALUES
('35 XXX 123', 'Mercedes Sprinter', 'Beyaz', 1500, 1, true, NOW(), NOW()),
('35 YYY 456', 'Iveco Daily', 'Mavi', 1200, 2, true, NOW(), NOW()),
('35 ZZZ 789', 'Ford Transit', 'Kırmızı', 1000, 3, true, NOW(), NOW()),
('34 AAA 111', 'MAN TGX', 'Siyah', 2000, NULL, true, NOW(), NOW());

-- Örnek Konum Verileri
INSERT INTO vehicle_locations (vehicleId, latitude, longitude, address, timestamp) VALUES
(1, 40.7580, 29.8604, 'İstanbul - Kartal', NOW() - INTERVAL 30 MINUTE),
(1, 40.7590, 29.8650, 'İstanbul - Maltepe', NOW() - INTERVAL 20 MINUTE),
(1, 40.7610, 29.8700, 'İstanbul - Pendik', NOW() - INTERVAL 10 MINUTE),
(1, 40.7650, 29.8750, 'İstanbul - Tuzla', NOW()),
(2, 40.7400, 29.8500, 'İstanbul - Diyarbakır Bulvarı', NOW() - INTERVAL 15 MINUTE),
(2, 40.7420, 29.8520, 'İstanbul - Kurtköy', NOW()),
(3, 40.7300, 29.8400, 'İstanbul - Aydın Caddesi', NOW() - INTERVAL 5 MINUTE),
(3, 40.7310, 29.8410, 'İstanbul - Avcılar', NOW());
