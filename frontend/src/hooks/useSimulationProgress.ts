import { useEffect, useRef, useState, useCallback } from 'react'
import { getSimulation } from '../api/client'

export interface SimProgress {
  progress: number
  message: string
  status: 'idle' | 'connecting' | 'running' | 'done' | 'error'
  usingPolling: boolean
}

export function useSimulationProgress(runId: string | null): SimProgress {
  const [state, setState] = useState<SimProgress>({ progress: 0, message: '', status: 'idle', usingPolling: false })
  const wsRef = useRef<WebSocket | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneRef = useRef(false)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const startPolling = useCallback((id: string) => {
    stopPolling()
    doneRef.current = false
    setState(s => ({ ...s, status: 'running', message: 'Checking simulation status…', usingPolling: true }))

    pollRef.current = setInterval(async () => {
      if (doneRef.current) { stopPolling(); return }
      try {
        const run = await getSimulation(id)
        if (run.status === 'done') {
          doneRef.current = true
          setState({ progress: 1, message: 'Simulation complete', status: 'done', usingPolling: true })
          stopPolling()
        } else if (run.status === 'failed') {
          doneRef.current = true
          setState(s => ({ ...s, status: 'error', message: 'Simulation failed on server', usingPolling: true }))
          stopPolling()
        } else {
          setState(s => ({ ...s, status: 'running', message: `Running… (${run.status})`, usingPolling: true }))
        }
      } catch {
        // keep polling silently
      }
    }, 2000)
  }, [stopPolling])

  useEffect(() => {
    if (!runId) {
      setState({ progress: 0, message: '', status: 'idle', usingPolling: false })
      stopPolling()
      return
    }

    doneRef.current = false
    setState({ progress: 0, message: 'Connecting…', status: 'connecting', usingPolling: false })

    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${wsProto}://${window.location.host}/ws/simulations/${runId}/progress`

    let receivedMessage = false
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setState(s => ({ ...s, status: 'running', message: 'Simulation started', usingPolling: false }))
    }

    ws.onmessage = (event) => {
      receivedMessage = true
      try {
        const data = JSON.parse(event.data as string)
        setState({
          progress: data.progress ?? 0,
          message: data.message ?? 'Running…',
          status: data.status === 'done' ? 'done' : 'running',
          usingPolling: false,
        })
        if (data.status === 'done') doneRef.current = true
      } catch { /* ignore parse errors */ }
    }

    ws.onerror = () => {
      // Don't surface raw "WebSocket error" to the user — fall back to polling
      if (!receivedMessage && !doneRef.current) startPolling(runId)
    }

    ws.onclose = (e) => {
      if (doneRef.current) return
      if (e.code !== 1000 && !receivedMessage) {
        // WS closed without ever getting data — use REST polling
        startPolling(runId)
      } else if (e.code !== 1000 && receivedMessage) {
        // Got some WS data but connection dropped early — keep polling
        startPolling(runId)
      }
    }

    return () => {
      ws.close(1000, 'unmounted')
      stopPolling()
      wsRef.current = null
    }
  }, [runId, startPolling, stopPolling])

  return state
}
