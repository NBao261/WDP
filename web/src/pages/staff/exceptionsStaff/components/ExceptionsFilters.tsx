import { Search, Filter, X } from 'lucide-react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export const SortButton = ({
  label,
  sortKey,
  currentSort,
  onSort,
}: {
  label: string;
  sortKey: string;
  currentSort: any;
  onSort: any;
}) => {
  const isActive = currentSort?.key === sortKey;

  const getIcon = () => {
    if (!isActive) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-gray-400" />;
    return currentSort.direction === 'desc' ? (
      <ArrowDown className="w-3.5 h-3.5 ml-1 text-[#060606]" />
    ) : (
      <ArrowUp className="w-3.5 h-3.5 ml-1 text-[#060606]" />
    );
  };

  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center justify-between w-full px-2 py-1 rounded text-[11px] uppercase font-semibold transition-colors ${isActive ? 'text-[#060606] bg-gray-200/50' : 'text-[#6b6b6b] hover:bg-gray-200/50 hover:text-[#060606]'}`}
    >
      <span>{label}</span>
      {getIcon()}
    </button>
  );
};

export const FilterDropdown = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = value === 'All' ? null : options.find((o) => o.value === value);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full pl-2 pr-1.5 py-1 rounded text-[11px] uppercase font-semibold transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-gray-300 ${value !== 'All' ? 'text-[#060606] bg-gray-200/50' : 'text-[#6b6b6b] hover:bg-gray-200/50 hover:text-[#060606] bg-transparent'}`}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 ml-1 flex-shrink-0 ${value !== 'All' ? 'text-[#060606]' : 'text-gray-400'}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[140px] bg-white border border-gray-100 rounded-lg shadow-lg z-[60] py-1 flex flex-col max-h-[200px] overflow-y-auto">
          <button
            onClick={() => {
              onChange('All');
              setIsOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-[#9FE870] hover:text-[#062F28] transition-colors ${value === 'All' ? 'bg-[#9FE870] text-[#062F28]' : 'text-gray-600'}`}
          >
            Tất cả
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-[#9FE870] hover:text-[#062F28] transition-colors truncate ${value === opt.value ? 'bg-[#9FE870] text-[#062F28]' : 'text-gray-600'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const SearchHeaderInput = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) => {
  const displayValue = value === 'All' ? '' : value;
  return (
    <div className="relative w-full">
      <input
        type="text"
        placeholder={label}
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-2 pr-6 py-1 bg-transparent border border-transparent rounded text-[11px] uppercase font-semibold text-[#060606] focus:outline-none focus:bg-white focus:border-gray-300 focus:ring-1 focus:ring-gray-300 transition-colors placeholder:text-[#6b6b6b] hover:bg-gray-200/50"
      />
      <Search className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-[#060606] opacity-70 pointer-events-none" />
    </div>
  );
};
