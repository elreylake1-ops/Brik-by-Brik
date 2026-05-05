"use client"

import type { RefurbScopeInput, KitchenScope, KitchenSize, BathroomScope, BedroomScope } from "@/types/scope"

type Props = {
  value: RefurbScopeInput
  onChange: (scope: RefurbScopeInput) => void
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
      {children}
    </h3>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-gray-600">{children}</label>
}

const selectClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

const checkboxLabelClass = "flex cursor-pointer items-center gap-2 text-sm text-gray-700"

export default function RefurbScopeForm({ value, onChange }: Props) {
  function set<K extends keyof RefurbScopeInput>(key: K, val: RefurbScopeInput[K]) {
    onChange({ ...value, [key]: val })
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold text-gray-800">Refurb Scope</h2>

      {/* Property Size */}
      <SectionHeading>Property Size</SectionHeading>
      <div className="mb-5 grid grid-cols-3 gap-4">
        <div>
          <FieldLabel>Bedrooms</FieldLabel>
          <select
            className={selectClass}
            value={value.bedrooms}
            onChange={(e) => set("bedrooms", Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Bathrooms</FieldLabel>
          <select
            className={selectClass}
            value={value.bathrooms}
            onChange={(e) => set("bathrooms", Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Floor Area (sqm)</FieldLabel>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Optional"
            className={selectClass}
            value={value.floorAreaSqm ?? ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.]/g, "")
              set("floorAreaSqm", raw === "" ? undefined : parseFloat(raw) || undefined)
            }}
          />
        </div>
      </div>

      {/* Kitchen */}
      <SectionHeading>Kitchen</SectionHeading>
      <div className="mb-5 grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Kitchen Scope</FieldLabel>
          <select
            className={selectClass}
            value={value.kitchen.scope}
            onChange={(e) =>
              set("kitchen", { ...value.kitchen, scope: e.target.value as KitchenScope })
            }
          >
            <option value="keep">Keep as-is</option>
            <option value="refresh">Refresh</option>
            <option value="upgrade">Upgrade</option>
            <option value="full_replace">Full Replacement</option>
          </select>
        </div>
        <div>
          <FieldLabel>Kitchen Size</FieldLabel>
          <select
            className={selectClass}
            value={value.kitchen.size}
            onChange={(e) =>
              set("kitchen", { ...value.kitchen, size: e.target.value as KitchenSize })
            }
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      </div>

      {/* Bathroom */}
      <SectionHeading>Bathroom</SectionHeading>
      <div className="mb-5">
        <FieldLabel>Bathroom Scope</FieldLabel>
        <select
          className={selectClass}
          value={value.bathroom.scope}
          onChange={(e) => set("bathroom", { scope: e.target.value as BathroomScope })}
        >
          <option value="cosmetic">Cosmetic (no cost estimate)</option>
          <option value="partial">Partial Refurb</option>
          <option value="full_replace">Full Replacement</option>
        </select>
      </div>

      {/* Bedrooms */}
      <SectionHeading>Bedrooms</SectionHeading>
      <div className="mb-5">
        <FieldLabel>Bedroom Scope</FieldLabel>
        <select
          className={selectClass}
          value={value.bedroom.scope}
          onChange={(e) => set("bedroom", { scope: e.target.value as BedroomScope })}
        >
          <option value="none">None</option>
          <option value="paint">Paint only</option>
          <option value="flooring">Flooring only</option>
          <option value="cosmetic_refresh">Cosmetic Refresh</option>
          <option value="full_refurb">Full Refurb</option>
        </select>
      </div>

      {/* Flooring */}
      <SectionHeading>Flooring</SectionHeading>
      <div className="mb-5">
        <label className={checkboxLabelClass}>
          <input
            type="checkbox"
            checked={value.flooring.replaceWholeProperty}
            onChange={(e) => set("flooring", { replaceWholeProperty: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
          />
          Replace Flooring — Whole Property
        </label>
      </div>

      {/* Major Works */}
      <SectionHeading>Major Works</SectionHeading>
      <div className="flex flex-col gap-2">
        <label className={checkboxLabelClass}>
          <input
            type="checkbox"
            checked={value.majorWorks.rewire}
            onChange={(e) =>
              set("majorWorks", { ...value.majorWorks, rewire: e.target.checked })
            }
            className="h-4 w-4 rounded border-gray-300"
          />
          Full rewire
        </label>
        <label className={checkboxLabelClass}>
          <input
            type="checkbox"
            checked={value.majorWorks.boiler}
            onChange={(e) =>
              set("majorWorks", { ...value.majorWorks, boiler: e.target.checked })
            }
            className="h-4 w-4 rounded border-gray-300"
          />
          Boiler replacement
        </label>
        <label className={checkboxLabelClass}>
          <input
            type="checkbox"
            checked={value.majorWorks.roof}
            onChange={(e) =>
              set("majorWorks", { ...value.majorWorks, roof: e.target.checked })
            }
            className="h-4 w-4 rounded border-gray-300"
          />
          Roof works
        </label>
      </div>
    </div>
  )
}
