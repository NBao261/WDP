import { useState, useRef, useCallback } from 'react';

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

interface UseAddressSearchReturn {
  query: string;
  setQuery: (q: string, skipSearch?: boolean) => void;
  suggestions: NominatimResult[];
  isLoading: boolean;
  showDropdown: boolean;
  hideDropdown: () => void;
  clearSearch: () => void;
  reverseGeocode: (lat: number, lng: number) => Promise<string | null>;
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const DEBOUNCE_MS = 400;

/**
 * Custom hook for address autocomplete and reverse geocoding using OpenStreetMap Nominatim.
 */
export function useAddressSearch(): UseAddressSearchReturn {
  const [query, setQueryState] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManualSet = useRef(false);

  const searchAddress = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        format: 'json',
        q: searchQuery,
        limit: '6',
        countrycodes: 'vn',
        addressdetails: '1',
        viewbox: '106.5,10.6,107.0,11.0',
        bounded: '0',
      });

      const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) throw new Error('Nominatim search failed');

      const data: NominatimResult[] = await response.json();
      setSuggestions(data);
      setShowDropdown(data.length > 0);
    } catch (error) {
      console.error('Address search error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setQuery = useCallback((q: string, skipSearch = false) => {
    setQueryState(q);

    if (skipSearch || isManualSet.current) {
      isManualSet.current = false;
      setShowDropdown(false);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchAddress(q);
    }, DEBOUNCE_MS);
  }, [searchAddress]);

  const hideDropdown = useCallback(() => {
    setShowDropdown(false);
  }, []);

  const clearSearch = useCallback(() => {
    setQueryState('');
    setSuggestions([]);
    setShowDropdown(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string | null> => {
    try {
      const params = new URLSearchParams({
        format: 'json',
        lat: lat.toString(),
        lon: lng.toString(),
        zoom: '18',
        addressdetails: '1',
      });

      const response = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) throw new Error('Nominatim reverse failed');

      const data = await response.json();
      if (data.display_name) {
        isManualSet.current = true;
        setQueryState(data.display_name);
        return data.display_name;
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
    }
    return null;
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    isLoading,
    showDropdown,
    hideDropdown,
    clearSearch,
    reverseGeocode,
  };
}
