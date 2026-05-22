"use client"

import { useMemo, useState, useEffect } from "react"
import { Country, State, City } from "country-state-city"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"

export interface LocationValue {
  countryCode: string
  country: string
  stateCode: string
  state: string
  city: string
}

interface LocationSelectProps {
  value: LocationValue
  onChange: (value: LocationValue) => void
  disabled?: boolean
}

const ALLOWED_COUNTRIES = ["MX", "US", "DO"]

const COUNTRY_NAMES_ES: Record<string, string> = {
  MX: "México",
  US: "Estados Unidos",
  DO: "República Dominicana",
}

export function LocationSelect({ value, onChange, disabled }: LocationSelectProps) {
  const [cityInput, setCityInput] = useState(value.city)

  useEffect(() => {
    setCityInput(value.city)
  }, [value.city])

  const countries = useMemo(() => {
    return Country.getAllCountries()
      .filter((c) => ALLOWED_COUNTRIES.includes(c.isoCode))
      .map((c) => ({
        value: c.isoCode,
        label: COUNTRY_NAMES_ES[c.isoCode] || c.name,
        canonicalName: c.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [])

  const states = useMemo(
    () => (value.countryCode ? State.getStatesOfCountry(value.countryCode) : []),
    [value.countryCode],
  )

  const stateOptions = useMemo(
    () =>
      states.map((s) => ({
        value: s.isoCode,
        label: s.name,
      })),
    [states],
  )

  const cities = useMemo(
    () =>
      value.countryCode && value.stateCode
        ? City.getCitiesOfState(value.countryCode, value.stateCode)
        : [],
    [value.countryCode, value.stateCode],
  )

  const cityOptions = useMemo(
    () =>
      cities.map((c) => ({
        value: c.name,
        label: c.name,
      })),
    [cities],
  )

  const hasStates = states.length > 0
  const hasCities = cities.length > 0

  function handleCountryChange(code: string) {
    const country = countries.find((c) => c.value === code)
    if (!country) return
    setCityInput("")
    onChange({
      countryCode: code,
      country: country.canonicalName,
      stateCode: "",
      state: "",
      city: "",
    })
  }

  function handleStateChange(code: string) {
    const state = states.find((s) => s.isoCode === code)
    if (!state) return
    setCityInput("")
    onChange({ ...value, stateCode: code, state: state.name, city: "" })
  }

  function handleCitySelect(cityName: string) {
    onChange({ ...value, city: cityName })
  }

  function handleCityInput(cityName: string) {
    setCityInput(cityName)
    onChange({ ...value, city: cityName })
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <Label>País *</Label>
        <SearchableSelect
          options={countries}
          value={value.countryCode}
          onChange={handleCountryChange}
          placeholder="Selecciona un país"
          searchPlaceholder="Buscar país..."
          emptyMessage="No se encontró el país."
          disabled={disabled}
        />
      </div>

      {hasStates && (
        <div className="col-span-2">
          <Label>Estado / Provincia *</Label>
          <SearchableSelect
            options={stateOptions}
            value={value.stateCode}
            onChange={handleStateChange}
            placeholder="Selecciona un estado"
            searchPlaceholder="Buscar estado..."
            emptyMessage="No se encontró el estado."
            disabled={disabled || !value.countryCode}
          />
        </div>
      )}

      <div className="col-span-2">
        <Label>Ciudad *</Label>
        {hasCities ? (
          <SearchableSelect
            options={cityOptions}
            value={value.city}
            onChange={handleCitySelect}
            placeholder="Selecciona una ciudad"
            searchPlaceholder="Buscar ciudad..."
            emptyMessage="No se encontró la ciudad."
            disabled={disabled || (hasStates && !value.stateCode)}
          />
        ) : (
          <Input
            value={cityInput}
            onChange={(e) => handleCityInput(e.target.value)}
            placeholder="Ciudad"
            disabled={disabled}
          />
        )}
      </div>
    </div>
  )
}
