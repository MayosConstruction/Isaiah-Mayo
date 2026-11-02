"""Transcribe a clip with the local Whisper base.en (sherpa-onnx). Usage: transcribe.py audio.wav
# Model: https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.en.tar.bz2 -> Setup/asr-models/ (Hugging Face is blocked here; GitHub works). Needs: uv pip install --python whisper-env/bin/python sherpa-onnx soundfile
Splits on silence so each segment has a start time."""
import sys, subprocess, json, numpy as np, soundfile as sf, sherpa_onnx, os
M=os.path.join(os.path.dirname(__file__),'asr-models/sherpa-onnx-whisper-base.en')
rec=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f'{M}/base.en-encoder.int8.onnx',decoder=f'{M}/base.en-decoder.int8.onnx',tokens=f'{M}/base.en-tokens.txt',language='en',task='transcribe')
a,sr=sf.read(sys.argv[1],dtype='float32')
# simple energy VAD: split on >=0.35s quiet
win=int(sr*0.05); e=np.array([np.sqrt(np.mean(a[i:i+win]**2)) for i in range(0,len(a),win)])
th=max(e.max()*0.06,1e-4); voiced=e>th
segs=[];start=None;quiet=0
for i,v in enumerate(voiced):
    if v:
        if start is None: start=i
        quiet=0
    elif start is not None:
        quiet+=1
        if quiet>=7: segs.append((start,i-quiet+1)); start=None; quiet=0
if start is not None: segs.append((start,len(voiced)))
out=[]
for s,t in segs:
    s0=max(0,s*win-int(.1*sr)); t0=min(len(a),t*win+int(.1*sr))
    if t0-s0<sr*0.3: continue
    st=rec.create_stream(); st.accept_waveform(sr,a[s0:t0]); rec.decode_stream(st)
    out.append({'start':round(s0/sr,2),'end':round(t0/sr,2),'text':st.result.text.strip()})
print(json.dumps(out,indent=1))
