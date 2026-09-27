"""Synteza espeak-ng (także głosy MBROLA) z dokładnymi czasami początku każdego słowa (zdarzenia WORD)."""
import ctypes as C
import numpy as np

_lib = C.CDLL("libespeak-ng.so.1")


class _EV(C.Structure):
    _fields_ = [("type", C.c_int), ("uid", C.c_uint), ("text_position", C.c_int), ("length", C.c_int),
                ("audio_position", C.c_int), ("sample", C.c_int), ("user_data", C.c_void_p), ("id", C.c_int64)]


_CB = C.CFUNCTYPE(C.c_int, C.POINTER(C.c_short), C.c_int, C.POINTER(_EV))
_state = {"buf": [], "ev": [], "sr": 22050}


def _cb(wav, n, ev):
    if wav and n > 0:
        _state["buf"].append(np.ctypeslib.as_array(wav, shape=(n,)).copy())
    i = 0
    while ev[i].type != 0:
        e = ev[i]
        if e.type == 1:
            _state["ev"].append((e.text_position, e.length, e.audio_position))
        elif e.type == 8:
            _state["sr"] = int(e.id)
        i += 1
    return 0


_cbref = _CB(_cb)
_state["sr"] = _lib.espeak_Initialize(2, 200, None, 0)
_lib.espeak_SetSynthCallback(_cbref)


def synth(text, voice="pl", rate=165):
    """Zwraca (próbki float32, sample_rate, [(start_s, indeks_słowa)]) dla tekstu ze słowami rozdzielonymi spacją."""
    _lib.espeak_SetVoiceByName(voice.encode())
    _lib.espeak_SetParameter(1, rate, 0)
    _state["buf"], _state["ev"] = [], []
    b = text.encode("utf-8")
    _lib.espeak_Synth(b, len(b) + 1, 0, 1, 0, 1, None, None)
    _lib.espeak_Synchronize()
    y = np.concatenate(_state["buf"]).astype(np.float32) / 32768.0 if _state["buf"] else np.zeros(1, np.float32)
    # pozycja znaku (od 1) -> indeks słowa
    starts, pos = [], 0
    for w in text.split(" "):
        starts.append(pos)
        pos += len(w) + 1
    out = []
    for tp, ln, ms in _state["ev"]:
        c = max(0, tp - 1)
        idx = max(i for i, s in enumerate(starts) if s <= c)
        if not out or out[-1][1] != idx:
            out.append((ms / 1000.0, idx))
    return y, _state["sr"], out


if __name__ == "__main__":
    import sys
    for v in ("pl", "mb-pl1"):
        y, sr, ev = synth(sys.argv[1], v)
        print(v, sr, round(len(y) / sr, 2), ev)
