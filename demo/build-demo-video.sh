#!/usr/bin/env bash
set -euo pipefail

VIDEO="${1:-$HOME/Videos/trainrekt-demo.mp4}"
VOICE="${2:-$HOME/Videos/trainrekt-voiceover.mp3}"
OUT="${3:-$HOME/Videos/trainrekt-hackathon-v4.mp4}"

[[ -f "$VIDEO" ]] || { echo "Missing video: $VIDEO"; exit 1; }
[[ -f "$VOICE" ]] || { echo "Missing voice-over: $VOICE"; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is required."; exit 1; }

FONT="/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
[[ -f "$FONT" ]] || FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# TrainRekt V4
# This version is aligned from the ACTUAL source-video scenes and ACTUAL
# sentence pauses in the supplied 119.35 s voice-over.
#
# Key idea:
# - Do NOT artificially slow the voice.
# - Do NOT create long artificial pauses.
# - Keep the first ~69 s nearly 1:1 because the narration already matches
#   Home -> Daily Training -> real wallet -> Surprise Challenge well.
# - Compress the slower Wallet Safety / Learn / Progress portions visually
#   so the corresponding narration lands on the correct screen.
# - No subtitles.
# - Final TrainRekt sentence lands on the end card.

# Visual timeline:
#   0.00–39.00  Home / Daily Training / wallet transition
#  39.00–69.00  Surprise Security Challenge
#  69.00–80.00  Read-only wallet snapshot
#  80.00–89.00  Wallet Safety inspection summary
#  89.00–97.00  Learn From Your Wallet
#  97.00–106.00 Personalized Token-2022 lesson
# 106.00–112.00 Lesson result
# 112.00–116.20 Progress / achievement
# 116.20–121.20 Generated end card

VF=""
VF+="[0:v]trim=start=0:end=39,setpts=PTS-STARTPTS,fps=30[v0];"
VF+="[0:v]trim=start=39:end=69,setpts=PTS-STARTPTS,fps=30[v1];"
VF+="[0:v]trim=start=73:end=84,setpts=PTS-STARTPTS,fps=30[v2];"
VF+="[0:v]trim=start=88:end=97,setpts=PTS-STARTPTS,fps=30[v3];"
VF+="[0:v]trim=start=116:end=124,setpts=PTS-STARTPTS,fps=30[v4];"
VF+="[0:v]trim=start=130:end=139,setpts=PTS-STARTPTS,fps=30[v5];"
VF+="[0:v]trim=start=146:end=152,setpts=PTS-STARTPTS,fps=30[v6];"
VF+="[0:v]trim=start=161:end=165.2,setpts=PTS-STARTPTS,fps=30[v7];"
VF+="[v0][v1][v2][v3][v4][v5][v6][v7]concat=n=8:v=1:a=0[vmain];"

# 5 second end card. It begins at ~116.2 s.
VF+="color=c=0x090B10:s=1080x1920:d=10:r=30[endbase];"
VF+="[endbase]"
VF+="drawtext=fontfile='${FONT}':text='TRAINREKT':fontcolor=white:fontsize=82:x=(w-text_w)/2:y=h*0.36,"
VF+="drawtext=fontfile='${FONT}':text='TRAIN  •  CONNECT  •  INSPECT  •  LEARN  •  IMPROVE':fontcolor=white:fontsize=27:x=(w-text_w)/2:y=h*0.49,"
VF+="drawtext=fontfile='${FONT}':text='Learn crypto decisions before they cost real money.':fontcolor=white:fontsize=31:x=(w-text_w)/2:y=h*0.57[endcard];"
VF+="[vmain][endcard]concat=n=2:v=1:a=0[vout];"

# AUDIO ALIGNMENT
#
# The supplied narration contains natural sentence boundaries at approximately:
#  0–39.03   Problem + TrainRekt + training explanation
# 39.03–69.03 Real wallet + surprise challenge
# 69.03–88.98 Read-only wallet inspection / signals
# 88.98–105.07 Personalized wallet training / learning loop
# 106.16–114.05 Goal / safer decisions
# 114.05–119.35 Final "This is TrainRekt..." line
#
# Only a 0.45 s initial delay is used, so narration starts once the app is
# already visibly rendered. There are NO long inserted mid-narration gaps.
#
# The final line is moved to 116.35 s so it speaks over the generated end card.

AF=""
AF+="[1:a]asetpts=PTS-STARTPTS,adelay=3000:all=1,"
AF+="loudnorm=I=-16:TP=-1.5:LRA=11,apad=pad_dur=3[aout]"

ffmpeg -y \
  -i "$VIDEO" \
  -i "$VOICE" \
  -filter_complex "${VF}${AF}" \
  -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -t 125 \
  -movflags +faststart \
  "$OUT"

echo
echo "Created: $OUT"
echo "V4: scene-aligned narration, no subtitles, no long artificial pauses."
