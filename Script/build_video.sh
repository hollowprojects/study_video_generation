#!/bin/bash

ffmpeg -loop 1 -i ../Images/tt.png \
       -i ../Outputs/audio_merged.m4a \
       -f lavfi -i "color=black:s=1920x1080:r=30" \
       -t 3900 \
-filter_complex "\
 [0:v]scale=1930:1090,\
      crop=1920:1080:\
        x='(iw-ow)/2':\
        y='(ih-oh)/2'\
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
../Outputs/subway_study_progress.mp4
