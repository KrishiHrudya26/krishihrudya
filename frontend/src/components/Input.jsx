export default function Input({ label, error, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        {...props}
        className={`w-full px-4 py-3 rounded-xl border-2 text-sm transition-all duration-200 bg-white
          ${error
            ? 'border-red-400 focus:border-red-500'
            : 'border-gray-200 focus:border-[#106f30]'
          } focus:ring-2 focus:ring-[#106f30]/20`}
      />
      {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
    </div>
  )
}
