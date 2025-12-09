"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/components/language-provider"

export function TestCaseGenerator() {
  const { toast } = useToast()
  const { t } = useLanguage()

  const [openaiKey, setOpenaiKey] = useState("")
  const [linearKey, setLinearKey] = useState("")
  const [issueId, setIssueId] = useState("")
  const [description, setDescription] = useState("")
  const [cases, setCases] = useState("")
  const [model, setModel] = useState("gpt-4o-mini")
  const [testCases, setTestCases] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showEnvWarning, setShowEnvWarning] = useState(false)

  const csvHeader = "項目,ユーザーロール（管理者かユーザー）,操作手順,期待結果"
  const canSubmit = (issueId.trim() || description.trim()) && !isGenerating

  const modelOptions = useMemo(
    () => [
      "gpt-4o-mini",
      "gpt-4o",
      "gpt-4.1",
      "gpt-4.1-mini",
      "o1",
      "o1-mini",
    ],
    [],
  )

  useEffect(() => {
    const savedOpenai = localStorage.getItem("openai-api-key") ?? ""
    const savedLinear = localStorage.getItem("linear-api-key") ?? ""
    setOpenaiKey(savedOpenai)
    setLinearKey(savedLinear)

    const checkEnv = async () => {
      try {
        const res = await fetch("/api/env-status")
        if (!res.ok) return
        const data = (await res.json()) as { hasOpenAI: boolean; hasLinear: boolean }
        if (!data.hasOpenAI && !data.hasLinear) {
          setShowEnvWarning(true)
        }
      } catch {
        // ignore
      }
    }
    void checkEnv()
  }, [])

  const handleGenerate = async () => {
    const casesNumber = cases ? Number(cases) : undefined
    if (cases && Number.isNaN(casesNumber)) {
      toast({
        title: t.invalidCases,
        description: t.invalidCasesDescription,
        variant: "destructive",
      })
      return
    }

    if (!issueId.trim() && !description.trim()) {
      toast({
        title: t.inputRequired,
        description: t.inputRequiredDescription,
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch("/api/generate-test-cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          issueIds: issueId || undefined,
          description: description || undefined,
          cases: casesNumber,
          model,
          linearApiKey: linearKey || undefined,
          openaiApiKey: openaiKey || undefined,
        }),
      })

      const data = (await response.json()) as { header?: string; csv?: string; error?: string }
      if (!response.ok || data.error) {
        const message = data.error || "Failed to generate test cases"
        throw new Error(message)
      }

      const header = data.header || csvHeader
      const csv = data.csv || ""
      setTestCases([header, csv].filter(Boolean).join("\n"))
      setErrorMessage(null)

      toast({
        title: t.testCasesGenerated,
        description: t.testCasesGeneratedDescription,
      })
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : t.errorDescription
      const isNotFound = rawMessage.toLowerCase().includes("issue not found")
      const message = isNotFound ? t.issueNotFound : rawMessage
      setTestCases("") // clear stale output on failure
      setErrorMessage(message)
      toast({
        title: t.error,
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(testCases)
    setCopied(true)
    toast({
      title: t.copiedToClipboard,
      description: t.copiedToClipboardDescription,
    })
    setTimeout(() => setCopied(false), 2000)
  }

  const previewLines = useMemo(() => {
    if (!testCases) return []
    return testCases.split("\n").filter(Boolean).slice(0, 5)
  }, [testCases])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t.linearTicketNumbers}</CardTitle>
          <CardDescription>{t.ticketNumbersDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showEnvWarning && !openaiKey && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t.envWarning}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issue">{t.ticketNumbers}</Label>
              <Textarea
                id="issue"
                placeholder="ENG-123, ENG-124"
                value={issueId}
                onChange={(e) => setIssueId(e.target.value)}
                rows={3}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">{t.issueHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cases">{t.testCaseCount}</Label>
              <Input
                id="cases"
                placeholder="5"
                value={cases}
                onChange={(e) => setCases(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.testCaseCountHint}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model">{t.model}</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t.modelHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="csvHeader">{t.csvHeaderLabel}</Label>
              <Input id="csvHeader" value={csvHeader} readOnly className="font-mono text-xs" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t.ticketDescription}</Label>
            <Textarea
              id="description"
              placeholder={t.ticketDescriptionPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {errorMessage}
            </div>
          )}

          <Button onClick={handleGenerate} disabled={!canSubmit} className="w-full">
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.generating}
              </>
            ) : (
              t.generateTestCases
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Output Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t.generatedTestCases}</CardTitle>
          <CardDescription>{t.csvOutputDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="output">{t.csvOutput}</Label>
            <Textarea
              id="output"
              value={testCases}
              readOnly
              rows={10}
              placeholder={t.csvOutputPlaceholder}
              className="font-mono text-sm"
            />
          </div>
          <Button onClick={handleCopy} disabled={!testCases} variant="secondary" className="w-full">
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                {t.copied}
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                {t.copyToClipboard}
              </>
            )}
          </Button>

          {previewLines.length > 0 && (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs font-semibold text-muted-foreground">{t.preview}</p>
              <div className="mt-2 space-y-1 font-mono text-xs text-foreground">
                {previewLines.map((line, idx) => (
                  <div key={idx} className="truncate">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
