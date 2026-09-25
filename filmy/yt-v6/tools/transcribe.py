import json, sys, whisper
m = whisper.load_model(sys.argv[3] if len(sys.argv) > 3 else "small")
prompt = "V6, Formuła Jeden, Nissan GT-R, Ferrari, McLaren Artura, sześćdziesiąt stopni, czop wału, łańcuszek rozrządu, turbosprężarki, Buick."
r = m.transcribe(sys.argv[1], language="pl", word_timestamps=True, initial_prompt=prompt, condition_on_previous_text=False, fp16=False)
words = [{"text": w["word"].strip(), "start": round(w["start"], 3), "end": round(w["end"], 3)} for s in r["segments"] for w in s["words"]]
json.dump(words, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
print(len(words), "words")
