"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "@/components/theme-provider"
import { useLanguage } from "@/components/language-provider"
import { Moon, Sun, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function SettingsForm() {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { toast } = useToast()
  const [linearApiKey, setLinearApiKey] = useState("")
  const [openaiApiKey, setOpenaiApiKey] = useState("")
  const [showLinearKey, setShowLinearKey] = useState(false)
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    // Load saved keys from localStorage
    const savedLinearKey = localStorage.getItem("linear-api-key")
    const savedOpenaiKey = localStorage.getItem("openai-api-key")

    if (savedLinearKey) {
      setLinearApiKey(savedLinearKey)
      setIsSaved(true)
    }
    if (savedOpenaiKey) {
      setOpenaiApiKey(savedOpenaiKey)
      setIsSaved(true)
    }
  }, [])

  const handleSave = () => {
    if (linearApiKey) {
      localStorage.setItem("linear-api-key", linearApiKey)
    }
    if (openaiApiKey) {
      localStorage.setItem("openai-api-key", openaiApiKey)
    }

    setIsSaved(true)
    toast({
      title: t.settingsSaved,
      description: t.settingsSavedDescription,
    })
  }

  return (
    <div className="space-y-6">
      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t.appearance}</CardTitle>
          <CardDescription>{t.appearanceDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="theme">{t.theme}</Label>
            <div className="flex gap-2">
              <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")}>
                <Sun className="h-4 w-4 mr-2" />
                {t.light}
              </Button>
              <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")}>
                <Moon className="h-4 w-4 mr-2" />
                {t.dark}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="language">{t.language}</Label>
            <Select value={language} onValueChange={(value) => setLanguage(value as "en" | "ja")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t.english}</SelectItem>
                <SelectItem value="ja">{t.japanese}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>{t.apiKeys}</CardTitle>
          <CardDescription>{t.apiKeysDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linear-key">{t.linearApiKey}</Label>
            <div className="relative">
              <Input
                id="linear-key"
                type={showLinearKey ? "text" : "password"}
                value={linearApiKey}
                onChange={(e) => setLinearApiKey(e.target.value)}
                placeholder="lin_api_..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowLinearKey(!showLinearKey)}
              >
                {showLinearKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showLinearKey ? t.hide : t.show} Linear API key</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="openai-key">{t.openaiApiKey}</Label>
            <div className="relative">
              <Input
                id="openai-key"
                type={showOpenaiKey ? "text" : "password"}
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowOpenaiKey(!showOpenaiKey)}
              >
                {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showOpenaiKey ? t.hide : t.show} OpenAI API key</span>
              </Button>
            </div>
          </div>

          <Button onClick={handleSave} className="w-full">
            {t.saveApiKeys}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
