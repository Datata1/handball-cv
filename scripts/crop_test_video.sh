INPUT="./match.mp4"
OUTPUT="./video_cropped.mp4"

# 1. Get the total duration of the video in seconds
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$INPUT")

# 2. Calculate a random start time (making sure we don't pick a time in the last 60 seconds)
START_TIME=$(awk -v dur="$DURATION" 'BEGIN { srand(); print int(rand() * (dur - 60)) }')

# 3. Cut the video
ffmpeg -ss "$START_TIME" -i "$INPUT" -t 60 -c copy "$OUTPUT"