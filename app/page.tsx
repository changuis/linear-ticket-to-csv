"use client"

import Link from "next/link"
import { TestCaseGenerator } from "@/components/test-case-generator"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/language-provider"

export default function Home() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">{t.appTitle}</h1>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <Settings className="h-5 w-5" />
              <span className="sr-only">{t.settings}</span>
            </Link>
          </Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <TestCaseGenerator />
      </main>
    </div>
  )
}
