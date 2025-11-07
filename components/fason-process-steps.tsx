import { Scissors, Shirt, Palette, Flame } from 'lucide-react'

const steps = [
  {
    title: "Kesim",
    description: "İlk aşama",
    icon: Scissors,
    color: "chart-3",
  },
  {
    title: "Dikim",
    description: "Ana üretim",
    icon: Shirt,
    color: "primary",
  },
  {
    title: "Baskı/Nakış",
    description: "Opsiyonel",
    icon: Palette,
    color: "chart-5",
  },
  {
    title: "Ütü",
    description: "Son aşama",
    icon: Flame,
    color: "chart-2",
  },
]

export function FasonProcessSteps() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {steps.map((step, index) => {
        const Icon = step.icon
        return (
          <div key={step.title} className="relative group">
            <div
              className={`p-6 rounded-xl bg-${step.color}/5 border border-${step.color}/20 transition-all duration-300 hover:bg-${step.color}/10 hover:border-${step.color}/40`}
            >
              <div className="flex flex-col items-center text-center">
                <div
                  className={`mb-4 p-4 rounded-full bg-${step.color}/10 text-${step.color} group-hover:scale-110 transition-transform duration-300`}
                >
                  <Icon className="w-8 h-8" />
                </div>

                <h4 className="text-lg font-semibold text-foreground mb-1">{step.title}</h4>

                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>

            {/* Connection Line */}
            {index < steps.length - 1 && (
              <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-border" />
            )}
          </div>
        )
      })}
    </div>
  )
}