# Jump-cut the take (drop pauses), alternate punch-ins, loudnorm, and write words.json
# with word timings on the cut timeline (Whisper text per speech chunk, words spread by length).
import subprocess, json, sys, numpy as np, soundfile as sf, sherpa_onnx
SEGS=[(0,4.06),(4.35,5.97),(6.40,7.43),(7.66,9.45),(9.99,10.77),(11.14,13.60),(14.14,14.71),(14.93,16.25),(16.71,21.46),(21.85,23.42)]
ZOOM=[1.0,1.18,1.0,1.18,1.3,1.0,1.3,1.18,1.0,1.18]
PAD=0.06
src='raw/take.mp4'
parts=[];labels=[];spans=[];t=0
for i,((a,b),z) in enumerate(zip(SEGS,ZOOM)):
    a=max(0,a-PAD); b=b+PAD
    cw,ch=f"trunc(iw/{z}/2)*2",f"trunc(ih/{z}/2)*2"
    parts.append(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS,crop={cw}:{ch}:(iw-{cw})/2:(ih-{ch})*0.35,scale=1080:1920,setsar=1[v{i}];"
                 f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={b-a-0.02:.3f}:d=0.02[a{i}];")
    labels.append(f"[v{i}][a{i}]"); spans.append((a,b,t)); t+=b-a
g="".join(parts)+"".join(labels)+f"concat=n={len(SEGS)}:v=1:a=1[v][a0];[a0]loudnorm=I=-14:TP=-1.5:LRA=11[a]"
subprocess.run(["ffmpeg","-v","error","-y","-i",src,"-filter_complex",g,"-map","[v]","-map","[a]","-c:v","libx264","-preset","medium","-crf","17","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","192k","-ar","48000","assets/cut.mp4"],check=True)
M='../../Setup/asr-models/sherpa-onnx-whisper-base.en'
rec=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f'{M}/base.en-encoder.int8.onnx',decoder=f'{M}/base.en-decoder.int8.onnx',tokens=f'{M}/base.en-tokens.txt',language='en',task='transcribe')
subprocess.run(["ffmpeg","-v","error","-y","-i",src,"-map","0:a:0","-ac","1","-ar","16000","/tmp/take16.wav"],check=True)
au,sr=sf.read('/tmp/take16.wav',dtype='float32')
words=[]
for (a,b,t0) in spans:
    st=rec.create_stream(); st.accept_waveform(sr,au[int(a*sr):int(b*sr)]); rec.decode_stream(st)
    ws=st.result.text.strip().split()
    ia,ib=t0+PAD,t0+(b-a)-PAD; L=sum(len(w)+1 for w in ws); c=ia
    for w in ws:
        d=(ib-ia)*(len(w)+1)/L; words.append({"w":w,"s":round(c,3),"e":round(c+d,3)}); c+=d
json.dump(words,open('words.json','w'),indent=0)
print(round(t,2)); print(" ".join(w["w"] for w in words))
