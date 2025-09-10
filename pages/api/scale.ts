// pages/api/scale.ts
export default function handler(req, res) {
  // 5 ile 50 kg arasında random değer üretelim
  const randomWeight = (Math.random() * (50 - 5) + 5).toFixed(2);

  res.status(200).json({ weight: randomWeight });
}
