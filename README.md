# mean-time

A tiny always-on-top floating widget for macOS that tracks the **mean time between interruptions** during a working session, plus total working vs interrupted time.

## Run

```bash
npm install
npm start
```

## Test

```bash
npm test
```

## Use

- **Start Session** — begins the timer
- **Interruption** — pause working time, start interrupted time (e.g. someone walks up to your desk)
- **Resume** — end the current interruption
- **End Session** — stop, save to history

Sessions are appended to `~/Library/Application Support/mean-time/history.json`.

## MTBI definition

Mean working-time gap between interruption starts. Wall-clock spent inside an interruption doesn't count as "time worked between interruptions." With 0 interruptions, MTBI is `—`.
