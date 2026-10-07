# Monitoring, Observability & Alerting Architecture

## 1. Full-Stack Observability Architecture

Wakeel integrates metrics, distributed traces, and application logs into a unified observability pipeline to detect regressions before they impact law firm operations:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Wakeel Telemetry Sources                        │
│                                                                        │
│   ┌───────────────────────────┐    ┌───────────────────────────────┐   │
│   │        apps/api           │    │          apps/web             │   │
│   │  • Sentry Error SDK       │    │  • Sentry Browser SDK         │   │
│   │  • OpenTelemetry Traces   │    │  • Web Vitals (INP, LCP, CLS) │   │
│   │  • Prometheus /metrics    │    │  • TanStack Query Errors      │   │
│   └─────────────┬─────────────┘    └───────────────┬───────────────┘   │
└─────────────────┼──────────────────────────────────┼───────────────────┘
                  │                                  │
                  ▼                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Observability Aggregation Layer                      │
│                                                                        │
│  ┌───────────────────────┐  ┌────────────────────┐  ┌───────────────┐  │
│  │   Prometheus Server   │  │    Sentry Cloud    │  │ Grafana Dash  │  │
│  │   (Scrapes Port 3001) │  │  (Error Tracking)  │  │ (Vis Panel)   │  │
│  └───────────┬───────────┘  └─────────┬──────────┘  └───────────────┘  │
└──────────────┼────────────────────────┼────────────────────────────────┘
               ▼                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Alert Notification Hub                          │
│        • PagerDuty (P1)  • Slack/Discord (#ops)  • WhatsApp Alert       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The Four Golden Signals & SLAs

| Golden Signal | Target Metric & SLA Threshold | Critical Alert Condition |
| :--- | :--- | :--- |
| **Latency** | • HTTP API p95: `< 250ms`<br>• LLM Time-to-First-Token: `< 600ms`<br>• Voice Receptionist Roundtrip: `< 1,200ms` | API p95 `> 1,500ms` for 5 mins<br>Voice latency `> 2,500ms` |
| **Traffic** | • Inbound WhatsApp webhooks: 50–500 req/sec<br>• Concurrent WhatsApp voice calls: 1–20 calls | Drop in inbound webhook traffic to 0 for > 15 mins during business hours |
| **Errors** | • HTTP 5xx rate: `< 0.05%`<br>• WhatsApp delivery failure: `< 1.0%`<br>• BullMQ job failure rate: `< 0.1%` | HTTP 5xx rate `> 2.0%`<br>BullMQ failed jobs `> 100` |
| **Saturation**| • Host CPU: `< 70%`<br>• PostgreSQL Connection Pool: `< 60%`<br>• Redis Memory Usage: `< 50%`<br>• Disk Storage: `< 75%` | CPU `> 85%` for 10 mins<br>Disk space `> 85%` |

---

## 3. Production Prometheus Alert Rules (`infra/monitoring/alerts.yml`)

```yaml
groups:
  - name: wakeel_critical_alerts
    rules:
      - alert: HighHttpErrorRate5xx
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.02
        for: 2m
        labels:
          severity: P1
        annotations:
          summary: "API 5xx error rate exceeds 2% over 5 minutes"

      - alert: OutboxQueueBackpressure
        expr: wakeel_outbox_unpublished_count > 1000
        for: 5m
        labels:
          severity: P2
        annotations:
          summary: "Transactional outbox lag exceeds 1,000 unpublished events"

      - alert: EmergencyEscalationSlaBreached
        expr: wakeel_escalations_open_overdue_count > 0
        for: 1m
        labels:
          severity: P1
        annotations:
          summary: "A critical legal escalation has breached the 15-minute SLA without lawyer claim"

      - alert: DefaultPartitionHasData
        expr: wakeel_partition_default_rows_count > 0
        for: 5m
        labels:
          severity: P2
        annotations:
          summary: "Rows detected in catch-all _default table partition"

      - alert: TenantAiBudgetExceeded
        expr: wakeel_tenant_ai_budget_used_percentage > 90
        for: 10m
        labels:
          severity: P3
        annotations:
          summary: "Law firm has utilized over 90% of monthly AI spend cap"
```

---

## 4. Key Performance Dashboard Panels (Grafana)

1. **WhatsApp Messaging Throughput:** Inbound vs outbound message rate, segmented by sender type (`CLIENT`, `AI`, `LAWYER`).
2. **AI Inference Unit Economics:** Daily token consumption and USD micros spent per tenant firm, broken down by provider (`groq`, `openai`).
3. **Escalation SLA Compliance:** Gauge tracking percentage of escalations claimed within 15 minutes.
4. **Voice Receptionist Health:** Real-time active calls, Call Dispositions pie chart (`BOOKED`, `ESCALATED`, `INFO`, `ABANDONED`), audio packet loss percentage.
