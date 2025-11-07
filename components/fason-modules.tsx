import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { BarChart3, Smartphone, MapPin, Settings, Users, FileText, ArrowRight } from 'lucide-react'

const modules = [
  {
    title: "Fason Dashboard",
    description: "İş emirlerini görüntüleyin, süreçleri takip edin ve detaylı raporlar oluşturun",
    icon: BarChart3,
    href: "/fason/dashboard",
    color: "primary",
  },
  {
    title: "Mobil Takipçi",
    description: "Telefon uygulaması için optimize edilmiş gerçek zamanlı takip formu",
    icon: Smartphone,
    href: "/fason/mobile-tracker",
    color: "chart-2",
  },
  {
    title: "Atölye Yönetimi",
    description: "Fason atölyelerini kaydedin, düzenleyin ve performanslarını izleyin",
    icon: MapPin,
    href: "/fason/workshops",
    color: "chart-5",
  },
  {
    title: "İş Emri Oluştur",
    description: "Manuel iş emri oluşturun veya ERP sisteminden otomatik alın",
    icon: Settings,
    href: "/fason/create-work-order",
    color: "accent",
  },
  {
    title: "Takipçi Yönetimi",
    description: "Fason takipçilerini yönetin, görevler atayın ve performans takibi yapın",
    icon: Users,
    href: "/fason/trackers",
    color: "chart-4",
  },
  {
    title: "Fason Raporları",
    description: "Detaylı fason takip raporları, analizler ve performans metrikleri",
    icon: FileText,
    href: "/fason/reports",
    color: "chart-3",
  },
]

export function FasonModules() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {modules.map((module) => {
        const Icon = module.icon
        return (
          <Link key={module.href} href={module.href}>
            <Card className="group h-full transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/50">
              <CardContent className="p-6 h-full flex flex-col">
                <div className="mb-4">
                  <div
                    className={`inline-flex p-3 rounded-xl bg-${module.color}/10 text-${module.color} group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {module.title}
                </h3>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-grow">{module.description}</p>

                <div className="flex items-center gap-2 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Modülü Aç</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}