import { useState } from 'react'

const COUNTRIES = [
  { code: '+91', flag: '🇮🇳', name: 'India'     },
  { code: '+1',  flag: '🇺🇸', name: 'USA'       },
  { code: '+44', flag: '🇬🇧', name: 'UK'        },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
]

export default function PhoneInput({ value, onChange, error }) {
  const [country, setCountry] = useState(COUNTRIES[0])
  const [open, setOpen]       = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">Phone Number</label>
      <div className={`flex rounded-xl border-2 overflow-hidden transition-all ${error ? 'border-red-400' : 'border-gray-200 focus-within:border-[#106f30]'}`}>
        <div className="relative">
          <button type="button" onClick={() => setOpen(!open)}
            className="flex items-center gap-1 px-3 py-3 bg-gray-50 hover:bg-gray-100 border-r border-gray-200 text-sm">
            <span>{country.flag}</span>
            <span className="text-gray-600">{country.code}</span>
            <span className="text-gray-400">▾</span>
          </button>
          {open && (
            <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 w-48">
              {COUNTRIES.map(c => (
                <button key={c.code} type="button"
                  onClick={() => { setCountry(c); setOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left">
                  <span>{c.flag}</span>
                  <span>{c.name}</span>
                  <span className="ml-auto text-gray-400">{c.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input type="tel" placeholder="9876543210"
          value={value.replace(country.code, '')}
          onChange={e => onChange(country.code + e.target.value.replace(/\D/g, ''))}
          className="flex-1 px-4 py-3 text-sm bg-white focus:outline-none" />
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  )
}
