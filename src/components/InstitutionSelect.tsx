import React, { useState, useEffect } from 'react';
import { getKnownInstitutions, registerInstitution } from '../utils/institutionManager';
import { Building2 } from 'lucide-react';

interface InstitutionSelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  helpText?: string;
}

export const InstitutionSelect: React.FC<InstitutionSelectProps> = ({
  id = 'inst-select',
  label,
  value,
  onChange,
  placeholder = 'Ex.: instituição interna ou entidade externa',
  required = false,
  className = '',
  helpText
}) => {
  const [knownList, setKnownList] = useState<string[]>([]);
  const datalistId = `datalist-${id}`;

  useEffect(() => {
    setKnownList(getKnownInstitutions());
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleBlur = () => {
    if (value && value.trim()) {
      const normalized = registerInstitution(value);
      onChange(normalized);
      setKnownList(getKnownInstitutions());
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
        <Building2 className="w-4 h-4 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />

        <datalist id={datalistId}>
          {knownList.map((inst) => (
            <option key={inst} value={inst} />
          ))}
        </datalist>
      </div>

      {helpText && (
        <p className="text-[10px] text-slate-500 leading-tight">{helpText}</p>
      )}
    </div>
  );
};
