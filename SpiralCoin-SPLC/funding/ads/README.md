# SpiralCoin Funding Ad Package

Production-ready creative assets for the SpiralCoin bootstrap-funding ad campaign.

## Files

| File | Purpose |
| --- | --- |
| `funding-landing.html` | Standalone landing page (no-index, no tracking) for paid funding referrals |
| `display-creative.html` | 3 banner creatives in one file. Use `?b=lead`, `?b=square`, `?b=story` |
| `video-ad-30s.html` | 30-second CSS animated video creative. `?v=1` switches to 1080×1920 vertical |
| `video-ad-30s.srt` | Caption file for the video |
| `video-ad-script.md` | VO script, storyboard, music, distribution + compliance |
| `funding-ad-draft.md` | Multi-channel copy package (X / LinkedIn / banner / grant / email) |
| `exports/` | PNG renders of the 3 banners |
| `obs-recording.md` | One-shot recipe for recording `video-ad-30s.html` to MP4 with OBS Studio |

## Rebuild banners

```powershell
pwsh -File funding/ads/render-banners.ps1
```

## Deploy to IONOS

```powershell
$env:IONOS_SFTP_PASSWORD = 'your-password'
pwsh -File deploy/run-sftp.ps1 -Script _sftp_ads_deploy.txt -LogPath _sftp_ads_log.txt
```

Lands at `https://www.spiralcoin.net/funding/ads/`.

## Compliance

All copy in this folder is bound by the project's compliance rules:

- No "guaranteed", "risk-free", or "always wins" language
- Disclaimer "Trading involves risk. Past performance does not guarantee future results." present on every visual
- Compliant CTAs only ("Review the Source", "Read the Pitch", "Open the Repo")
- No invented trust signals, certifications, or testimonials
