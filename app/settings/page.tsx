"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsForm } from "@/components/settings-form"
import { useLanguage } from "@/components/language-provider"

export default function SettingsPage() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">{t.backToHome}</span>
            </Link>
          </Button>
          <h1 className="text-xl font-semibold text-foreground">{t.settingsTitle}</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <SettingsForm />
      </main>
    </div>
  )
}
