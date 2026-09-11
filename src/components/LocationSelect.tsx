import React, { useState, useEffect } from 'react';
import { getKnownLocations, registerLocation, DEFAULT_DEFENSE_LOCATION } from '../utils/locationManager';
import { MapPin } from 'lucide-react';

interface LocationSelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  helpText?: string;
}

export const LocationSelect: React.FC<LocationSelectProps> = ({
  id = 'loc-select',
  label = 'Local da Apresentação',
  value,
  onChange,
  placeholder = DEFAULT_DEFENSE_LOCATION,
  required = false,
  className = '',
  helpText
}) => {
  const [knownList, setKnownList] = useState<string[]>([]);
  const datalistId = `datalist-${id}`;

  useEffect(() => {
    setKnownList(getKnownLocations());
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleBlur = () => {
    if (value && value.trim()) {
      const normalized = registerLocation(value);
      onChange(normalized);
      setKnownList(getKnownLocations());
    }
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          id={id}
          list={datalistId}
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          className="w-full p-2.5 pl-8 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900 font-medium"
        />
        <MapPin className="w-4 h-4 text-emerald-700 absolute left-2.5 top-3 pointer-events-none" />

        <datalist id={datalistId}>
          {knownList.map((loc) => (
            <option key={loc} value={loc} />
          ))}
        </datalist>
      </div>

      {helpText && (
        <p className="text-[10px] text-slate-500 leading-tight">{helpText}</p>
      )}
    </div>
  );
};
