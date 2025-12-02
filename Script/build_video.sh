#!/bin/bash

ffmpeg -loop 1 -i ../Images/tt.png \
       -i ../Outputs/audio_merged.m4a \
       -f lavfi -i "color=black:s=1920x1080:r=30" \
       -t 3900 \
-filter_complex "\
 [0:v]scale=1930:1090,\
      crop=1920:1080:x='(iw-ow)/2':y='(ih-oh)/2',\
      zoompan=z='min(zoom+0.00002,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:fps=30:s=1920x1080,\
      eq=gamma=1.05:brightness='0.02*sin(2*PI*t/8)',\
      vignette=PI/8,\
      noise=alls=6:allf=t+u\
      [base]; \
 [2:v]noise=alls=60:allf=t,\
      gblur=sigma=20,\
      format=rgba,\
      colorchannelmixer=aa=0.12[dust]; \
 [base][dust]overlay=0:0,\
      noise=alls=2:allf=t[outv] \
" \
-map "[outv]" -map 1:a \
-c:v libx264 -pix_fmt yuv420p -crf 19 -preset veryslow \
-c:a aac -b:a 192k \
../Outputs/moody_study_library.mp4