# OBS Studio Recording Recipe — `video-ad-30s.html`

The 30-second creative is a self-contained, deterministic CSS animation. Record it once with OBS, then publish the MP4 to YouTube / X / LinkedIn / IG.

## One-time OBS profile

1. Install **OBS Studio** ([obsproject.com](https://obsproject.com)).
2. **Settings → Video**
   - Base (Canvas) Resolution: `1920 x 1080`
   - Output (Scaled) Resolution: `1920 x 1080`
   - FPS: `30`
3. **Settings → Output**
   - Output Mode: `Advanced`
   - Recording → Type: `Standard`
   - Recording Format: `MP4`
   - Encoder: `x264` (or NVENC / QuickSync if available)
   - Rate Control: `CBR`
   - Bitrate: `10000 Kbps`
   - Keyframe Interval: `2`
   - Profile: `high`
4. **Settings → Audio** — leave all desktop / mic sources DISABLED (silent video; VO overlaid in post).

## Scene setup

1. **+ Scene** → name `SpiralCoin Ad 30s`.
2. **+ Source → Browser**
   - URL: `file:///C:/Users/Trisha%20Dreyer/Documents/ionos-migration/funding/ads/video-ad-30s.html`
   - Width: `1920`
   - Height: `1080`
   - FPS: `30`
   - Custom CSS: *(leave default)*
   - ✅ Shutdown source when not visible
   - ✅ Refresh browser when scene becomes active

## Recording procedure

1. Select the `SpiralCoin Ad 30s` scene.
2. Right-click the Browser source → **Interact** → press F5 to reset the animation (optional).
3. Click **Start Recording**.
4. Wait **exactly 30 seconds** (the animation loops via CSS `infinite`; cut at 30s for one clean play).
5. Click **Stop Recording**.

Output MP4 lands in your configured **Recording Path**.

## Vertical (1080×1920) variant

Repeat with:

- Base / Output Resolution: `1080 x 1920`
- Browser source URL: `…/video-ad-30s.html?v=1`
- Browser Width/Height: `1080 / 1920`

## Trim to exactly 30 seconds (optional, ffmpeg)

If your recording is slightly longer (e.g. 31s due to click latency):

```powershell
ffmpeg -i recording.mp4 -ss 0 -t 30 -c copy spiralcoin-ad-30s.mp4
```

## Post-production checklist

- [ ] Add VO from `video-ad-script.md` (DAW or `ffmpeg` overlay)
- [ ] Burn in `.srt` captions for silent autoplay platforms
- [ ] Confirm disclaimer "Trading involves risk…" is legible in final cut
- [ ] Upload to YouTube as **Unlisted** first; QA on phone + desktop
- [ ] Tag with campaign UTM in description, NOT in the creative itself
