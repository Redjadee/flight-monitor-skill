# Flight Monitor — Paths Reference

## Base Directory

```
~/.flight-monitor/
├── monitors.json          # All monitor task records
└── history/
    └── <monitor-id>.csv   # Price history per monitor
```

## monitors.json schema

```json
[
  {
    "id": "fm-abc123",
    "origin": "PEK",
    "destination": "LHR",
    "depart_date": "2025-06-15",
    "flex_days": 3,
    "return_date": null,
    "cabin": "BUSINESS",
    "adults": 1,
    "nonstop": false,
    "airlines": [],
    "alert_days": 7,
    "discord_channel_id": "1234567890",
    "currency": "CNY",
    "check_interval": "1d",
    "cron_job_id": "cron-xyz789",
    "status": "active",
    "created_at": "2025-06-01T10:00:00Z",
    "last_checked": "2025-06-01T16:00:00Z",
    "last_price": 6240,
    "last_flight": "CA937"
  }
]
```

## history/<monitor-id>.csv schema

```csv
timestamp,date,price,currency,carrier,flight,duration
2025-06-01T10:00:00Z,2025-06-16,6240,CNY,CA,CA937,PT10H30M
```
