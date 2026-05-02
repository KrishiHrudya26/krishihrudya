export default function BrandPanel({ subtitle }) {
  return (
    <div style={{ background: '#106f30' }} className="hidden lg:flex flex-col justify-between h-full p-10 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20" style={{ background: '#33a02b' }} />
      <div className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full opacity-15" style={{ background: '#ffbe26' }} />
      <div className="absolute top-1/2 -right-12 w-48 h-48 rounded-full opacity-10" style={{ background: '#009de0' }} />
      <div className="relative z-10">
        <img src="/logo_vertical.png" alt="Krishi Hrudya" className="w-48 drop-shadow-lg" />
      </div>
      <div className="relative z-10">
        <h2 style={{ fontFamily: "'DM Serif Display', serif" }} className="text-white text-4xl leading-tight mb-4">
          Connecting Farms<br />
          <span style={{ color: '#ffbe26' }}>to the Future</span>
        </h2>
        <p className="text-green-100 text-base leading-relaxed max-w-xs">
          {subtitle || 'Monitor and control your agricultural devices from anywhere in the world.'}
        </p>
      </div>
      <div className="relative z-10 flex gap-8">
        {[
          { value: '6,000+', label: 'Active Devices' },
          { value: '50K',    label: 'Target Scale'   },
          { value: '24/7',   label: 'Monitoring'     },
        ].map(stat => (
          <div key={stat.label}>
            <p style={{ color: '#ffbe26', fontFamily: "'DM Serif Display', serif" }} className="text-2xl font-bold">{stat.value}</p>
            <p className="text-green-200 text-xs mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
