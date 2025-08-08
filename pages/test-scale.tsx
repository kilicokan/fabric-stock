import { useEffect, useState } from "react";
import axios from "axios";

export default function TestScale() {
  const [weight, setWeight] = useState("0.00");

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get("/api/scale");
        setWeight(res.data.weight);
      } catch (err) {
        console.error("Tartı verisi alınamadı");
      }
    }, 1000); // 1 saniyede bir güncelle

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "20px", fontSize: "24px" }}>
      🧵 <b>Tartım:</b> {weight} kg
    </div>
  );
}
