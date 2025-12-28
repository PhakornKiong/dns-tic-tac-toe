import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Copy, Terminal, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export interface DNSQuery {
  id: string
  query: string
  response?: string
  timestamp: Date
  type: 'new' | 'join' | 'board' | 'move' | 'reset'
  latency?: {
    dns?: number // DNS query latency in ms
    api?: number // API request latency in ms
    total?: number // Total latency (API + DNS) in ms
  }
}

interface DNSQueryDisplayProps {
  queries: DNSQuery[]
  onClear?: () => void
  dnsHost?: string
  dnsPort?: number
  dnsZone?: string
}

export function DNSQueryDisplay({ queries, onClear, dnsHost, dnsPort, dnsZone }: DNSQueryDisplayProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getQueryTypeColor = (type: DNSQuery['type']) => {
    switch (type) {
      case 'new':
        return 'default'
      case 'join':
        return 'secondary'
      case 'board':
        return 'outline'
      case 'move':
        return 'default'
      case 'reset':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const formatQuery = (query: string) => {
    // Format: dig TXT query (uses system DNS resolver)
    // Or: dig @host -p port TXT query (if host is specified)
    if (dnsHost) {
      const portFlag = dnsPort && dnsPort !== 53 ? ` -p ${dnsPort}` : '';
      return `dig @${dnsHost}${portFlag} TXT ${query}`;
    }
    return `dig TXT ${query}`;
  }

  const isJSON = (str: string): boolean => {
    try {
      JSON.parse(str)
      return true
    } catch {
      return false
    }
  }

  const formatJSON = (str: string): string => {
    try {
      const parsed = JSON.parse(str)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return str
    }
  }

  const getFormattedResponse = (response: string): string => {
    // Try to detect and format JSON
    const trimmed = response.trim()
    if (isJSON(trimmed)) {
      return formatJSON(trimmed)
    }
    return response
  }

  return (
    <Card className="h-full flex flex-col shadow-lg border-0">
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Terminal className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">DNS Queries</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Equivalent DNS queries for your actions
              </CardDescription>
            </div>
          </div>
          {onClear && queries.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-xs">
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto pt-6 custom-scrollbar">
        {queries.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Terminal className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No DNS queries yet</p>
            <p className="text-xs mt-1 opacity-70">Actions will appear here as you play</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queries.slice().reverse().map((query) => (
              <div key={query.id} className="space-y-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant={getQueryTypeColor(query.type)} className="text-xs font-medium px-2 py-0.5">
                      {query.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {query.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {query.latency && (
                    <div className="flex items-center justify-end gap-1.5 group/latency">
                      {query.latency.api !== undefined ? (
                        <>
                          <Badge variant="outline" className="text-xs font-mono px-1.5 py-0.5 bg-muted/50 group-hover/latency:hidden">
                            {query.latency.api}ms
                          </Badge>
                          {query.latency.dns !== undefined && (
                            <div className="hidden group-hover/latency:flex items-center gap-1.5">
                              <Badge variant="outline" className="text-xs font-mono px-1.5 py-0.5 bg-muted/50">
                                {query.latency.total !== undefined ? query.latency.total : query.latency.api}ms
                              </Badge>
                              <span className="text-[10px] text-muted-foreground/70 font-mono">
                                DNS:{query.latency.dns}ms API:{query.latency.api}ms
                              </span>
                            </div>
                          )}
                        </>
                      ) : query.latency.total !== undefined ? (
                        <Badge variant="outline" className="text-xs font-mono px-1.5 py-0.5 bg-muted/50">
                          {query.latency.total}ms
                        </Badge>
                      ) : null}
                    </div>
                  )}
                </div>
                {/* Request */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-muted-foreground px-1">Request</div>
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg font-mono text-xs relative group hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <code className="break-all text-slate-700 dark:text-slate-300">{formatQuery(query.query)}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-slate-600"
                      onClick={() => copyToClipboard(formatQuery(query.query))}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {/* Response */}
                {query.response && (
                  <Collapsible defaultOpen={false} className="group">
                    <div className="space-y-1.5">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between p-0 h-auto font-semibold text-xs text-muted-foreground hover:text-foreground -ml-1"
                        >
                          <span className="px-1">Response</span>
                          <ChevronRight className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 p-3 rounded-lg font-mono text-xs relative group hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors mt-1.5">
                          <code className="break-all text-blue-900 dark:text-blue-200 whitespace-pre-wrap overflow-x-auto block">{getFormattedResponse(query.response)}</code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-200 dark:hover:bg-blue-900"
                            onClick={() => copyToClipboard(query.response || '')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}
                <Separator className="opacity-50" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

