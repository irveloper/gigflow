"use client"

import { Fragment } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = [
  { label: "Verify email" },
  { label: "Create organization" },
  { label: "Dashboard" },
]

interface ActivationStepperProps {
  currentStep: 1 | 2 | 3
}

export function ActivationStepper({ currentStep }: ActivationStepperProps) {
  return (
    <div className="flex items-center justify-between w-full max-w-sm mx-auto mb-6">
      {STEPS.map((step, i) => {
        const stepNumber = i + 1
        const isCompleted = stepNumber < currentStep
        const isCurrent = stepNumber === currentStep

        return (
          <Fragment key={step.label}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  isCompleted && "bg-blue-600 text-white",
                  isCurrent && "border-2 border-blue-600 text-blue-600 bg-white",
                  !isCompleted && !isCurrent && "border-2 border-gray-200 text-gray-400 bg-white",
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isCurrent && "text-gray-900",
                  !isCurrent && "text-gray-400",
                )}
              >
                {step.label}
              </span>
            </div>

            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-px mx-2 mb-5 transition-colors",
                  isCompleted ? "bg-blue-600" : "bg-gray-200",
                )}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
