import { useState, useEffect, useRef } from "react";

const BRAND_GREEN = "#106f30";
const BRAND_AMBER = "#f0a500";

const installationPhotos = [
  {
    id: 1,
    src: "/media/install_horamavu1.JPG",
    location: "Horamavu Agara, Bengaluru",
    date: "31 Aug 2025",
    lat: "13.041806°N",
    lng: "77.654011°E",
  },
  {
    id: 2,
    src: "/media/install_kengeri.JPG",
    location: "Kengeri Satellite Town, Bengaluru",
    date: "15 Sep 2025",
    lat: "12.911668°N",
    lng: "77.478323°E",
  },
  {
    id: 3,
    src: "/media/install_horamavu2.JPG",
    location: "Horamavu, Bengaluru",
    date: "10 Sep 2025",
    lat: "13.033814°N",
    lng: "77.657523°E",
  },
  {
    id: 4,
    src: "/media/install_naagarabhaavi.JPG",
    location: "Naagarabhaavi, Bengaluru",
    date: "17 Sep 2025",
    lat: "12.970846°N",
    lng: "77.516306°E",
  },
];

const stats = [
  { value: "4.56B+", label: "Litres Water Pumped", icon: "💧" },
  { value: "1.82B+", label: "Litres Water Saved", icon: "🌿" },
  { value: "4000+", label: "Installations Across India", icon: "📍" },
  { value: "100%", label: "Motor Burn Protection", icon: "⚡" },
];

const products = [
  {
    name: "Smart Starter (KHS)",
    tagline: "The Farm's Guardian",
    color: BRAND_GREEN,
    icon: "🔌",
    features: [
      "100% motor burn protection",
      "Pump scheduling via app & timers",
      "Dry-run & phase-failure detection",
      "Real-time telemetry over 4G/GSM",
      "Suitable for borewell & canal pumps",
    ],
    description:
      "The KHS Smart Starter is the cornerstone of our product suite. Installed directly in the motor control panel, it continuously monitors voltage, current, and phase conditions — preventing costly motor burnouts before they happen.",
  },
  {
    name: "IrriBOT Valve",
    tagline: "Wireless Irrigation Control",
    color: BRAND_AMBER,
    icon: "🌊",
    features: [],
    description: "",
  },
  {
    name: "IrriBOT Smart Sense",
    tagline: "Soil Intelligence Platform",
    color: "#1d9e75",
    icon: "🌱",
    features: [],
    description: "",
  },
];

const timeline = [
  { year: "2020", event: "Krishi Hrudaya founded with a mission to protect farmers from motor burnouts" },
  { year: "2021", event: "First Smart Starter prototype deployed in Karnataka; backed by IKP Eden" },
  { year: "2022", event: "Partnership with Art of Living for watershed project in Karnataka" },
  { year: "2023", event: "100+ installations milestone; IrriBOT Valve launched" },
  { year: "2024", event: "500+ installations; IrriBOT Smart Sense & Control commercialized" },
  { year: "2025", event: "KrishiHrudya IoT platform launched; expansion to pan-India markets" },
];

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

function AnimatedCounter({ target }) {
  const [count, setCount] = useState(0);
  const [ref, inView] = useInView();
  useEffect(() => {
    if (!inView) return;
    const num = parseFloat(target.replace(/[^0-9.]/g, ""));
    const steps = 60;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setCount(Math.round((num * step) / steps * 100) / 100);
      if (step >= steps) clearInterval(interval);
    }, 1800 / steps);
    return () => clearInterval(interval);
  }, [inView, target]);
  return (
    <span ref={ref}>
      {target.includes("B") ? count.toFixed(2) + "B" : target.includes("%") ? count + "%" : count}
      {target.includes("+") ? "+" : ""}
    </span>
  );
}

export default function ContentPage() {
  const [activePhoto, setActivePhoto] = useState(0);
  const [activeProduct, setActiveProduct] = useState(0);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => { setTimeout(() => setHeroVisible(true), 100); }, []);
  useEffect(() => {
    const t = setInterval(() => setActivePhoto(p => (p + 1) % installationPhotos.length), 4000);
    return () => clearInterval(t);
  }, []);

  const [statsRef, statsInView] = useInView();
  const [timelineRef, timelineInView] = useInView();
  const [missionRef, missionInView] = useInView();

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #106f30 0%, #0d5a26 60%, #083d1b 100%)", minHeight: "92vh" }}>
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10" style={{ background: "#fff", transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10" style={{ background: "#fff", transform: "translate(-30%, 30%)" }} />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 flex flex-col lg:flex-row items-center gap-12 min-h-screen">
          <div className="flex-1 text-white" style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateY(0)" : "translateY(32px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full text-sm font-medium" style={{ background: "rgba(255,255,255,0.15)" }}>
              <span>🌾</span> The Farm's Heart
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-6" style={{ fontFamily: "Georgia,serif", letterSpacing: "-0.02em" }}>
              Gateway to<br /><span style={{ color: "#f0a500" }}>Every Farm</span>
            </h1>
            <p className="text-xl leading-relaxed mb-8 max-w-lg" style={{ color: "rgba(255,255,255,0.85)" }}>
              Krishi Hrudaya builds IoT-powered farm automation for India's 130 million farming families — protecting motors, automating irrigation, and delivering soil intelligence.
            </p>
          </div>
          <div className="flex-shrink-0 w-full lg:w-72 rounded-3xl p-8 text-center" style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateX(0)" : "translateX(32px)", transition: "all 0.9s cubic-bezier(0.16,1,0.3,1) 0.2s", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <div className="text-7xl mb-4">🌾</div>
            <p className="text-white font-semibold text-lg mb-2">The Farm's Heart</p>
            <p className="text-sm leading-relaxed" style={{ color: "#bbf7d0" }}>Protecting motors. Automating irrigation. Delivering soil intelligence.</p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 60L1440 60L1440 20C1200 60 960 0 720 20C480 40 240 0 0 20L0 60Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* MISSION */}
      <section ref={missionRef} className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div style={{ opacity: missionInView ? 1 : 0, transform: missionInView ? "translateX(0)" : "translateX(-24px)", transition: "all 0.7s ease 0.1s" }}>
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND_GREEN }}>Welcome to</p>
            <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: "Georgia,serif" }}>Krishi Hrudaya</h2>
            <p className="text-gray-600 leading-relaxed mb-6 text-lg">India has 130 million farming families. Most use electric pump motors to draw water — and motor burnout costs a farmer ₹20,000–₹80,000 and weeks of crop loss. We built the Smart Starter to end this.</p>
            <p className="text-gray-600 leading-relaxed mb-8">Our platform combines hardware, 4G connectivity, MQTT telemetry, and AI analytics to give farmers complete control over their water infrastructure from any smartphone. Backed by IKP Eden and partnering with Art of Living on watershed projects across Karnataka.</p>
            <div className="flex flex-wrap gap-3">
              {["IoT Automation", "Water Budgeting", "Motor Protection", "Soil Intelligence", "AI & ML"].map(tag => (
                <span key={tag} className="px-4 py-2 rounded-full text-sm font-medium" style={{ background: "#e8f5ed", color: BRAND_GREEN }}>{tag}</span>
              ))}
            </div>
          </div>
          <div style={{ opacity: missionInView ? 1 : 0, transform: missionInView ? "translateX(0)" : "translateX(24px)", transition: "all 0.7s ease 0.2s" }}>
            <div className="rounded-3xl p-8" style={{ background: "linear-gradient(135deg, #e8f5ed 0%, #c8ebd5 100%)" }}>
              <div className="text-center mb-8">
                <div className="text-6xl mb-3">🏡</div>
                <p className="font-semibold text-lg" style={{ color: BRAND_GREEN }}>Pioneers in Connected Farm Solutions</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[{ icon: "📡", label: "4G + LoRa", sub: "Connectivity" }, { icon: "📱", label: "App Control", sub: "Anytime, Anywhere" }, { icon: "🛡️", label: "Motor Guard", sub: "24/7 Protection" }].map(item => (
                  <div key={item.label} className="rounded-2xl p-4 bg-white">
                    <div className="text-3xl mb-2">{item.icon}</div>
                    <div className="font-semibold text-sm text-gray-800">{item.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="products" className="py-20" style={{ background: "#fafafa" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND_AMBER }}>What We Serve</p>
            <h2 className="text-4xl font-bold" style={{ fontFamily: "Georgia,serif" }}>Our Products & Services</h2>
          </div>
          <div className="flex flex-wrap gap-2 mb-8 p-1 rounded-2xl w-fit mx-auto" style={{ background: "#ebebeb" }}>
            {products.map((p, i) => (
              <button key={p.name} onClick={() => i === 0 && setActiveProduct(0)}
                className="px-5 py-3 rounded-xl text-sm font-medium transition-all"
                style={{ background: activeProduct === i ? p.color : "transparent", color: activeProduct === i ? "#fff" : i === 0 ? "#555" : "#aaa", cursor: i === 0 ? "pointer" : "not-allowed", opacity: i === 0 ? 1 : 0.6 }}>
                {p.icon} {p.name.split(" ")[0]} {p.name.split(" ")[1]}
                {i > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full" style={{ background: "#d4d4d4", color: "#888", fontSize: "10px" }}>Soon</span>}
              </button>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ background: BRAND_GREEN + "18", color: BRAND_GREEN }}>
                🔌 The Farm's Guardian
              </div>
              <h3 className="text-3xl font-bold mb-4" style={{ fontFamily: "Georgia,serif" }}>Smart Starter (KHS)</h3>
              <p className="text-gray-600 leading-relaxed mb-8">The KHS Smart Starter is the cornerstone of our product suite. Installed directly in the motor control panel, it continuously monitors voltage, current, and phase conditions — preventing costly motor burnouts before they happen.</p>
              <ul className="space-y-3">
                {products[0].features.map(f => (
                  <li key={f} className="flex items-start gap-3">
                    <span className="mt-1 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs" style={{ background: BRAND_GREEN, color: "#fff" }}>✓</span>
                    <span className="text-gray-700">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl p-10 flex flex-col items-center justify-center text-center min-h-72" style={{ background: BRAND_GREEN + "18", border: "2px solid " + BRAND_GREEN + "30" }}>
              <img src="/media/khs_device.jpg" alt="KHS Smart Starter" className="w-48 h-48 object-contain mb-6 rounded-2xl" />
              <h4 className="text-xl font-bold mb-2" style={{ color: BRAND_GREEN }}>Smart Starter (KHS)</h4>
              <p className="text-gray-600 text-sm">The Farm's Guardian</p>
            </div>
          </div>
        </div>
      </section>

      {/* INSTALLATIONS GALLERY */}
      <section id="installations" className="py-20 max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND_GREEN }}>Field Deployments</p>
          <h2 className="text-4xl font-bold" style={{ fontFamily: "Georgia,serif" }}>Installations Across Bengaluru</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">Each photo is GPS-tagged from our field team — real farmers, real farms, real impact.</p>
        </div>
        <div className="relative rounded-3xl overflow-hidden mb-4" style={{ height: 480 }}>
          {installationPhotos.map((photo, i) => (
            <div key={photo.id} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: activePhoto === i ? 1 : 0 }}>
              <img src={photo.src} alt={photo.location} className="w-full h-full object-cover" />
	      <div className="absolute bottom-0 left-0 right-0 p-5" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.75))" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold text-lg">📍 {photo.location}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs px-2 py-1 rounded-full font-mono" style={{ background: "rgba(255,255,255,0.15)", color: "#bbf7d0" }}>Lat {photo.lat}</span>
                  <span className="text-xs px-2 py-1 rounded-full font-mono" style={{ background: "rgba(255,255,255,0.15)", color: "#bbf7d0" }}>Long {photo.lng}</span>
                  <span className="text-xs ml-auto" style={{ color: "rgba(255,255,255,0.6)" }}>{photo.date}</span>
                 </div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {installationPhotos.map((photo, i) => (
            <button key={photo.id} onClick={() => setActivePhoto(i)} className="relative rounded-2xl overflow-hidden transition-all"
              style={{ height: 100, outline: activePhoto === i ? "3px solid " + BRAND_GREEN : "3px solid transparent", outlineOffset: "2px", opacity: activePhoto === i ? 1 : 0.65 }}>
              <img src={photo.src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </section>

      {/* BWSSB VIDEO */}
      <section className="py-20 max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND_GREEN }}>Case Study</p>
          <h2 className="text-4xl font-bold" style={{ fontFamily: "Georgia,serif" }}>
            BWSSB <span style={{ color: BRAND_GREEN }}>×</span> KrishiHrudaya
          </h2>
          <p className="text-gray-500 mt-4 max-w-2xl mx-auto leading-relaxed">
            How we partnered with the Bruhat Bengaluru Water Supply and Sewerage Board to solve critical motor protection and water management challenges across Bengaluru's pumping infrastructure.
          </p>
        </div>
        <div className="rounded-3xl overflow-hidden" style={{ boxShadow: "0 8px 40px rgba(16,111,48,0.15)", border: "2px solid #106f3020" }}>
          <video controls className="w-full" style={{ display: "block", maxHeight: 520, background: "#000" }}>
            <source src="/media/KH.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20" style={{ background: "linear-gradient(180deg, #f0f9f4 0%, #ffffff 100%)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND_GREEN }}>The Technology</p>
            <h2 className="text-4xl font-bold" style={{ fontFamily: "Georgia,serif" }}>How KrishiHrudaya Works</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "01", icon: "📡", title: "Device Monitors", desc: "KHS Smart Starter monitors voltage, current, and phase conditions 24/7 at the motor panel." },
              { step: "02", icon: "☁️", title: "Data to Cloud", desc: "Telemetry streams over 4G/GSM via MQTT to our TimescaleDB platform every 30 seconds." },
              { step: "03", icon: "🧠", title: "AI Analyzes", desc: "Analytics engine detects anomalies, predicts failures, and generates irrigation recommendations." },
              { step: "04", icon: "📱", title: "Farmer Controls", desc: "Farmer receives alerts, views history, and remotely operates pumps/valves from their phone." },
            ].map((item, i) => (
              <div key={item.step} className="rounded-2xl p-6 bg-white border border-gray-100 hover:border-green-200 transition-all hover:-translate-y-1" style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
                <div className="text-xs font-bold mb-3 opacity-40">{item.step}</div>
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="font-bold text-gray-800 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IMPACT STATS */}
      <section ref={statsRef} className="py-20" style={{ background: BRAND_GREEN }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: "#bbf7d0" }}>Our Impact</p>
            <h2 className="text-4xl font-bold text-white" style={{ fontFamily: "Georgia,serif" }}>Product Statistics</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
                <div className="text-4xl mb-3">{s.icon}</div>
                <div className="text-3xl font-bold text-white mb-2">
                  {statsInView ? <AnimatedCounter target={s.value} /> : "—"}
                </div>
                <div className="text-sm" style={{ color: "#bbf7d0" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section ref={timelineRef} className="py-20 max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND_GREEN }}>Our Story</p>
          <h2 className="text-4xl font-bold" style={{ fontFamily: "Georgia,serif" }}>Journey So Far</h2>
        </div>
        <div className="relative">
          <div className="absolute left-16 top-0 bottom-0 w-0.5" style={{ background: "#e5e7eb" }} />
          <div className="space-y-8">
            {timeline.map((item, i) => (
              <div key={item.year} className="flex items-start gap-8"
                style={{ opacity: timelineInView ? 1 : 0, transform: timelineInView ? "translateX(0)" : "translateX(-16px)", transition: "all 0.5s ease " + (i * 0.1) + "s" }}>
                <div className="flex-shrink-0 w-32 text-right">
                  <span className="font-bold text-lg" style={{ color: BRAND_GREEN }}>{item.year}</span>
                </div>
                <div className="relative flex-shrink-0">
                  <div className="w-4 h-4 rounded-full mt-1" style={{ background: BRAND_GREEN }} />
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-gray-700 leading-relaxed">{item.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center" style={{ background: "#fafafa", borderTop: "1px solid #e5e7eb" }}>
        <div className="max-w-2xl mx-auto">
          <div className="text-5xl mb-6">🌾</div>
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: "Georgia,serif" }}>Ready to Protect Your Farm?</h2>
          <p className="text-gray-600 text-lg mb-8">Join 500+ farmers across India who trust KrishiHrudaya for their motor protection and irrigation automation needs.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="tel:+918431158163" className="px-8 py-4 rounded-xl font-semibold text-white transition-all hover:scale-105" style={{ background: BRAND_GREEN }}>📞 +91 84311 58163</a>
            <a href="https://krishihrudya.com" target="_blank" rel="noreferrer" className="px-8 py-4 rounded-xl font-semibold border-2 transition-all hover:scale-105" style={{ borderColor: BRAND_GREEN, color: BRAND_GREEN }}>Visit Website →</a>
          </div>
        </div>
      </section>
    </div>
  );
}
